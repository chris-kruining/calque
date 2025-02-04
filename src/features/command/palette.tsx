import { Accessor, Component, createEffect, createMemo, createSignal, For, JSX, Show } from "solid-js";
import { useI18n } from "../i18n";
import { CommandType } from "./command";
import { useCommands } from "./context";
import css from "./palette.module.css";

export interface CommandPaletteApi {
    readonly open: Accessor<boolean>;
    show(): void;
    hide(): void;
}

export const CommandPalette: Component<{ api?: (api: CommandPaletteApi) => any, onSubmit?: SubmitHandler<CommandType> }> = (props) => {
    const [open, setOpen] = createSignal<boolean>(false);
    const [root, setRoot] = createSignal<HTMLDialogElement>();
    const [search, setSearch] = createSignal<SearchContext<CommandType>>();
    const context = useCommands();
    const { t } = useI18n();

    if (!context) {
        console.log('context is missing...');
    }

    const api = {
        open,
        show() {
            setOpen(true);
        },
        hide() {
            setOpen(false);
        },
    };

    createEffect(() => {
        props.api?.(api);
    });


    createEffect(() => {
        const isOpen = open();

        if (isOpen) {
            search()?.clear();
            root()?.showModal();
        } else {
            root()?.close();
        }
    });

    const onSubmit = (command: CommandType) => {
        setOpen(false);
        props.onSubmit?.(command);

        command();
    };

    return <dialog ref={setRoot} class={css.commandPalette} onClose={() => setOpen(false)}>
        <SearchableList title="command palette" items={context.commands()} keySelector={item => t(item.label) as string} context={setSearch} onSubmit={onSubmit}>{
            (item, ctx) => {
                const label = t(item.label) as string;
                const filter = ctx.filter().toLowerCase();
                const length = filter.length;
                const indices = [0, ...Array.from(label.matchAll(new RegExp(filter, 'gi')).flatMap(({ index }) => [index, index + length]))];

                return <For each={indices.map((current, i) => label.slice(current, indices[i + 1]))}>{
                    (part) => <Show when={part.toLowerCase() === filter} fallback={part}><b>{part}</b></Show>
                }</For>;
            }
        }</SearchableList>
    </dialog>;
};

interface SubmitHandler<T> {
    (item: T): any;
}

interface SearchContext<T> {
    readonly filter: Accessor<string>;
    readonly results: Accessor<T[]>;
    readonly value: Accessor<T | undefined>;
    searchFor(term: string): void;
    clear(): void;
}

interface SearchableListProps<T> {
    items: T[];
    title?: string;
    keySelector(item: T): string;
    filter?: (item: T, search: string) => boolean;
    children(item: T, context: SearchContext<T>): JSX.Element;
    context?: (context: SearchContext<T>) => any,
    onSubmit?: SubmitHandler<T>;
}

function SearchableList<T>(props: SearchableListProps<T>): JSX.Element {
    const [term, setTerm] = createSignal<string>('');
    const [selected, setSelected] = createSignal<number>(0);
    const id = createUniqueId();

    const results = createMemo(() => {
        const search = term();

        if (search === '') {
            return [];
        }

        return props.items.filter(item => props.filter ? props.filter(item, search) : props.keySelector(item).toLowerCase().includes(search.toLowerCase()));
    });

    const value = createMemo(() => results().at(selected()));

    const ctx = {
        filter: term,
        results,
        value,
        searchFor(term: string) {
            setTerm(term);
        },
        clear() {
            setTerm('');
            setSelected(0);
        },
    };

    createEffect(() => {
        props.context?.(ctx);
    });

    createEffect(() => {
        const length = results().length - 1;

        setSelected(current => Math.min(current, length));
    });

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            setSelected(current => Math.max(0, current - 1));

            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            setSelected(current => Math.min(results().length - 1, current + 1));

            e.preventDefault();
        }
    };

    const onSubmit = (e: SubmitEvent) => {
        e.preventDefault();

        const v = value();

        if (v === undefined) {
            return;
        }

        ctx.clear();
        props.onSubmit?.(v);
    };

    return <search title={props.title}>
        <form method="dialog" class={css.search} onkeydown={onKeyDown} onsubmit={onSubmit}>
            <input id={`search-${id}`} value={term()} onInput={(e) => setTerm(e.target.value)} placeholder="start typing for command" autofocus autocomplete="off" enterkeyhint="go" />

            <output for={`search-${id}`}>
                <For each={results()}>{
                    (result, index) => <div class={`${index() === selected() ? css.selected : ''}`}>{props.children(result, ctx)}</div>
                }</For>
            </output>
        </form>
    </search>;
};

let keyCounter = 0;
const createUniqueId = () => `key-${keyCounter++}`;

