import { Accessor, Component, createEffect, createMemo, createSignal, For, JSX, Show, untrack } from "solid-js";
import { decode, Mutation } from "~/utilities";
import { Column, GridApi as GridCompApi, Grid as GridComp } from "~/components/grid";
import { createDataSet, DataSetNode, DataSetRowNode } from "~/features/dataset";
import { SelectionItem } from "../selectable";
import { useI18n } from "../i18n";
import { debounce } from "@solid-primitives/scheduled";
import css from "./grid.module.css"
import { Textarea } from "~/components/textarea";

export type Entry = { key: string } & { [lang: string]: string };
export interface GridApi {
    readonly mutations: Accessor<Mutation[]>;
    readonly selection: Accessor<SelectionItem<number, Entry>[]>;
    remove(indices: number[]): void;
    addKey(key: string): void;
    addLocale(locale: string): void;
    selectAll(): void;
    clearSelection(): void;
};

const groupBy = (rows: DataSetRowNode<number, Entry>[]) => {
    type R = DataSetRowNode<number, Entry> & { _key: string };

    const group = (nodes: R[]): DataSetNode<number, Entry>[] => Object
        .entries(Object.groupBy(nodes, r => r._key.split('.').at(0)!) as Record<number, R[]>)
        .map<any>(([key, nodes]) => nodes.at(0)?._key === key
            ? nodes[0]
            : ({ kind: 'group', key, groupedBy: 'key', nodes: group(nodes.map(n => ({ ...n, _key: n._key.slice(key.length + 1) }))) })
        );

    return group(rows.filter(r => r.value.key).map<R>(r => ({ ...r, _key: r.value.key }))) as any;
}

export function Grid(props: { class?: string, rows: Entry[], locales: string[], api?: (api: GridApi) => any, children?: (key: string) => JSX.Element }) {
    const { t } = useI18n();

    const [addedLocales, setAddedLocales] = createSignal<string[]>([]);
    const rows = createDataSet<Entry>(() => props.rows, { group: { by: 'key', with: groupBy } });
    const locales = createMemo(() => [...props.locales, ...addedLocales()]);
    const columns = createMemo<Column<Entry>[]>(() => [
        {
            id: 'key',
            label: t('feature.file.grid.key'),
            renderer: ({ value }) => props.children?.(value) ?? value.split('.').at(-1),
        },
        ...locales().toSorted().map<Column<Entry>>(lang => ({
            id: lang,
            label: lang,
            renderer: ({ row, column, value, mutate }) => {
                const lang = String(column);
                const { key } = rows.value[row]!;

                return <Textarea
                    class={css.textarea}
                    value={value ?? ''}
                    lang={lang}
                    oninput={next => mutate(next)}
                    placeholder={`${key} in ${lang}`}
                />
            },
        }))
    ]);

    const [api, setApi] = createSignal<GridCompApi<Entry>>();

    // Normalize dataset in order to make sure all the files have the correct structure
    // createEffect(() => {
    //     // For tracking
    //     props.rows;

    //     rows.mutateEach(({ key, ...locales }) => ({ key, ...Object.fromEntries(Object.entries(locales).map(([locale, value]) => [locale, value ?? ''])) }))
    // });

    // createEffect(() => {
    //     const l = addedLocales();

    //     rows.mutateEach(({ key, ...rest }) => ({ key, ...rest, ...Object.fromEntries(l.map(locale => [locale, rest[locale] ?? ''])) }));
    // });

    createEffect(() => {
        props.api?.({
            mutations: rows.mutations,
            selection: createMemo(() => api()?.selection() ?? []),
            remove: rows.remove,
            addKey(key) {
                rows.insert({ key, ...Object.fromEntries(locales().map(l => [l, ''])) });
            },
            addLocale(locale) {
                setAddedLocales(locales => new Set([...locales, locale]).values().toArray())
            },
            selectAll() {
                api()?.selectAll();
            },
            clearSelection() {
                api()?.clearSelection();
            },
        });
    });

    return <GridComp data={rows} columns={columns()} api={setApi} />;
};

const TextArea: Component<{ row: number, key: string, lang: string, value: string, oninput?: (next: string) => any }> = (props) => {
    return <Textarea
        class={css.textarea}
        value={props.value}
        lang={props.lang}
        oninput={props.oninput}
    />
};