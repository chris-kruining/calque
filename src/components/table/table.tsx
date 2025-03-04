import { Accessor, createContext, createEffect, createMemo, createSignal, For, JSX, Match, Show, Switch, useContext } from "solid-js";
import { selectable, SelectionItem, SelectionProvider, useSelection } from "~/features/selectable";
import { DataSetRowNode, DataSetNode, DataSet } from '~/features/dataset';
import { FaSolidAngleDown, FaSolidSort, FaSolidSortDown, FaSolidSortUp } from "solid-icons/fa";
import css from './table.module.css';

selectable;

export type CellRenderer<T extends Record<string, any>, K extends keyof T> = (cell: { row: number, column: K, value: T[K] }) => JSX.Element;
export type CellRenderers<T extends Record<string, any>> = { [K in keyof T]?: CellRenderer<T, K> };

export interface Column<T extends Record<string, any>> {
    id: keyof T,
    label: string,
    sortable?: boolean,
    group?: string,
    renderer?: CellRenderer<T, keyof T>,
    readonly groupBy?: (rows: DataSetRowNode<keyof T, T>[]) => DataSetNode<keyof T, T>[],
};

export interface TableApi<T extends Record<string, any>> {
    readonly selection: Accessor<SelectionItem<number, T>[]>;
    readonly rows: Accessor<DataSet<T>>;
    readonly columns: Accessor<Column<T>[]>;
    selectAll(): void;
    clearSelection(): void;
}

interface TableContextType<T extends Record<string, any>> {
    readonly rows: Accessor<DataSet<T>>,
    readonly columns: Accessor<Column<T>[]>,
    readonly selection: Accessor<SelectionItem<number, T>[]>,
    readonly selectionMode: Accessor<SelectionMode>,
    readonly cellRenderers: Accessor<CellRenderers<T>>,
}

const TableContext = createContext<TableContextType<any>>();

const useTable = <T extends Record<string, any>>() => useContext(TableContext)! as TableContextType<T>

export enum SelectionMode {
    None,
    Single,
    Multiple
}
type TableProps<T extends Record<string, any>> = {
    class?: string,
    summary?: string,
    rows: DataSet<T>,
    columns: Column<T>[],
    selectionMode?: SelectionMode,
    children?: CellRenderers<T>,
    api?: (api: TableApi<T>) => any,
};

export function Table<T extends Record<string, any>>(props: TableProps<T>) {
    const [selection, setSelection] = createSignal<SelectionItem<number, T>[]>([]);

    const rows = createMemo(() => props.rows);
    const columns = createMemo<Column<T>[]>(() => props.columns ?? []);
    const selectionMode = createMemo(() => props.selectionMode ?? SelectionMode.None);
    const cellRenderers = createMemo<CellRenderers<T>>(() => props.children ?? {});

    const context: TableContextType<T> = {
        rows,
        columns,
        selection,
        selectionMode,
        cellRenderers,
    };

    return <TableContext.Provider value={context}>
        <SelectionProvider selection={setSelection} multiSelect={props.selectionMode === SelectionMode.Multiple}>
            <Api api={props.api} />

            <InnerTable class={props.class} summary={props.summary} data={rows()} />
        </SelectionProvider>
    </TableContext.Provider>;
};

type InnerTableProps<T extends Record<string, any>> = { class?: string, summary?: string, data: DataSet<T> };

function InnerTable<T extends Record<string, any>>(props: InnerTableProps<T>) {
    const table = useTable<T>();

    const selectable = createMemo(() => table.selectionMode() !== SelectionMode.None);
    const columnCount = createMemo(() => table.columns().length);

    return <table class={`${css.table} ${selectable() ? css.selectable : ''} ${props.class}`} style={{ '--columns': columnCount() }}>
        {/* <Show when={(props.summary?.length ?? 0) > 0 ? props.summary : undefined}>{
            summary => {
                return <caption class={css.caption}>{summary()}</caption>;
            }
        }</Show> */}

        <Groups />
        <Head />

        <tbody class={css.main}>
            <For each={props.data.nodes() as DataSetNode<number, T>[]}>{
                node => <Node node={node} depth={0} />
            }</For>
        </tbody>

        {/* <Show when={true}>
            <tfoot class={css.footer}>
                <tr>
                    <td colSpan={columnCount()}>FOOTER</td>
                </tr>
            </tfoot>
        </Show> */}
    </table>
};

function Api<T extends Record<string, any>>(props: { api: undefined | ((api: TableApi<T>) => any) }) {
    const table = useTable<T>();
    const selectionContext = useSelection<number, T>();

    const api: TableApi<T> = {
        selection: selectionContext.selection,
        rows: table.rows,
        columns: table.columns,
        selectAll() {
            selectionContext.selectAll();
        },
        clearSelection() {
            selectionContext.clear();
        },
    };

    createEffect(() => {
        props.api?.(api);
    });

    return null;
};

function Groups(props: {}) {
    const table = useTable();

    const groups = createMemo(() => {
        return new Set(table.columns().map(c => c.group).filter(g => g !== undefined)).values().toArray();
    });

    return <For each={groups()}>{
        group => <colgroup span="1" data-group-name={group} />
    }</For>
}

function Head(props: {}) {
    const table = useTable();
    const context = useSelection();

    return <thead class={css.header}>
        <tr>
            <Show when={table.selectionMode() !== SelectionMode.None}>
                <th class={css.checkbox}>
                    <input
                        type="checkbox"
                        checked={context.selection().length > 0 && context.selection().length === context.length()}
                        indeterminate={context.selection().length !== 0 && context.selection().length !== context.length()}
                        on:input={(e: InputEvent) => e.target.checked ? context.selectAll() : context.clear()}
                    />
                </th>
            </Show>

            <For each={table.columns()}>{
                ({ id, label, sortable }) => {
                    const sort = createMemo(() => table.rows().sorting);
                    const by = String(id);

                    const onPointerDown = (e: PointerEvent) => {
                        if (sortable !== true) {
                            return;
                        }

                        table.rows().sort(current => {
                            if (current?.by !== by) {
                                return { by, reversed: false };
                            }

                            if (current.reversed === true) {
                                return undefined;
                            }

                            return { by, reversed: true };
                        });
                    };

                    return <th scope="col" class={`${css.cell} ${sort()?.by === by ? css.sorted : ''}`} onpointerdown={onPointerDown}>
                        {label}

                        <Switch>
                            <Match when={sortable && sort()?.by !== by}><FaSolidSort /></Match>
                            <Match when={sortable && sort()?.by === by && sort()?.reversed !== true}><FaSolidSortUp /></Match>
                            <Match when={sortable && sort()?.by === by && sort()?.reversed === true}><FaSolidSortDown /></Match>
                        </Switch>
                    </th>;
                }
            }</For>
        </tr>
    </thead>;
};

function Node<K extends number | string, T extends Record<string, any>>(props: { node: DataSetNode<K, T>, depth: number, groupedBy?: keyof T }) {
    return <Switch>
        <Match when={props.node.kind === 'row' ? props.node : undefined}>{
            row => <Row key={row().key} value={row().value} depth={props.depth} groupedBy={props.groupedBy} />
        }</Match>

        <Match when={props.node.kind === 'group' ? props.node : undefined}>{
            group => <Group key={group().key} groupedBy={group().groupedBy} nodes={group().nodes} depth={props.depth} />
        }</Match>
    </Switch>;
}

function Row<K extends number | string, T extends Record<string, any>>(props: { key: K, value: T, depth: number, groupedBy?: keyof T }) {
    const table = useTable<T>();
    const context = useSelection<K, T>();
    const columns = table.columns;

    const isSelected = context.isSelected(props.key);

    return <tr class={css.row} style={{ '--depth': props.depth }} use:selectable={{ value: props.value, key: props.key }}>
        <Show when={table.selectionMode() !== SelectionMode.None}>
            <th class={css.checkbox}>
                <input type="checkbox" checked={isSelected()} on:input={() => context.select([props.key])} on:pointerdown={e => e.stopPropagation()} />
            </th>
        </Show>

        <For each={columns()}>{
            ({ id }) => {
                const content = table.cellRenderers()[id]?.({ row: props.key as number, column: id, value: props.value[id] }) ?? props.value[id];

                return <td class={css.cell}>{content}</td>;
            }
        }</For>
    </tr>;
};

function Group<K extends number | string, T extends Record<string, any>>(props: { key: K, groupedBy: keyof T, nodes: DataSetNode<K, T>[], depth: number }) {
    const table = useTable();

    return <tr class={css.group}>
        <td colSpan={table.columns().length}>
            <table class={css.table}>
                <thead class={css.header}>
                    <tr><th class={css.cell} colSpan={table.columns().length} style={{ '--depth': props.depth }}>
                        <label>
                            <input type="checkbox" checked name="collapse" />
                            <FaSolidAngleDown />

                            {String(props.key)}</label>
                    </th></tr>
                </thead>

                <tbody class={css.main}>
                    <For each={props.nodes}>{
                        node => <Node node={node} depth={props.depth + 1} groupedBy={props.groupedBy} />
                    }</For>
                </tbody>
            </table>
        </td>
    </tr>;
};

declare module "solid-js" {
    namespace JSX {
        interface HTMLAttributes<T> {
            indeterminate?: boolean | undefined;
        }
    }
}