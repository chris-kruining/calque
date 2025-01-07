import { createMemo, createSignal, For, JSX, Setter, createEffect, Show } from "solid-js";
import { Dropdown, DropdownApi } from "../dropdown";
import css from './index.module.css';

interface SelectProps<T, K extends string> {
    id: string;
    class?: string;
    value: K;
    setValue?: Setter<K>;
    values: Record<K, T>;
    open?: boolean;
    showCaret?: boolean;
    children: (key: K, value: T) => JSX.Element;
    filter?: (query: string, key: K, value: T) => boolean;
}

export function Select<T, K extends string>(props: SelectProps<T, K>) {
    const [dropdown, setDropdown] = createSignal<DropdownApi>();
    const [key, setKey] = createSignal<K>(props.value);
    const [query, setQuery] = createSignal<string>('');

    const showCaret = createMemo(() => props.showCaret ?? true);
    const values = createMemo(() => {
        let entries = Object.entries<T>(props.values) as [K, T][];
        const filter = props.filter;
        const q = query();

        if (filter) {
            entries = entries.filter(([k, v]) => filter(q, k, v));
        }

        return entries;
    });

    createEffect(() => {
        props.setValue?.(() => key());
    });

    const text = <Show when={key()}>{
        key => {
            const value = createMemo(() => props.values[key()]);

            return <>{props.children(key(), value())}</>;
        }
    }</Show>

    return <Dropdown api={setDropdown} id={props.id} class={`${css.box} ${props.class}`} showCaret={showCaret()} open={props.open} text={text}>
        <Show when={props.filter !== undefined}>
            <header>
                <input value={query()} onInput={e => setQuery(e.target.value)} />
            </header>
        </Show>

        <main>
            <For each={values()}>{
                ([k, v]) => {
                    const selected = createMemo(() => key() === k);

                    return <span class={`${css.option} ${selected() ? css.selected : ''}`} onpointerdown={() => {
                        setKey(() => k);
                        dropdown()?.hide();
                    }}>{props.children(k, v)}</span>;
                }
            }</For>
        </main>
    </Dropdown>
}