import { createMemo, createSignal, For, JSX, Setter, createEffect, Show } from "solid-js";
import { FaSolidAngleDown } from "solid-icons/fa";
import css from './index.module.css';

interface DropdownProps<T, K extends string> {
    id: string;
    class?: string;
    value?: K;
    setValue?: Setter<K | undefined>;
    values: Record<K, T>;
    open?: boolean;
    showCaret?: boolean;
    children: (key: K, value: T) => JSX.Element;
    filter?: (query: string, key: K, value: T) => boolean;
}

export function Dropdown<T, K extends string>(props: DropdownProps<T, K>) {
    const [dialog, setDialog] = createSignal<HTMLDialogElement>();
    const [key, setKey] = createSignal<K | undefined>(props.value);
    const [open, setOpen] = createSignal<boolean>(props.open ?? false);
    const [query, setQuery] = createSignal<string>('');

    const values = createMemo(() => {
        let entries = Object.entries<T>(props.values) as [K, T][];
        const filter = props.filter;
        const q = query();

        if (filter) {
            entries = entries.filter(([k, v]) => filter(q, k, v));
        }

        return entries;
    });

    const showCaret = createMemo(() => props.showCaret ?? true);

    createEffect(() => {
        props.setValue?.(() => key());
    });

    createEffect(() => {
        dialog()?.[open() ? 'showPopover' : 'hidePopover']();
    });

    return <section class={`${css.box} ${props.class}`}>
        <button id={`${props.id}_button`} popoverTarget={`${props.id}_dialog`} class={css.button}>
            <Show when={key()}>{
                key => {
                    const value = createMemo(() => props.values[key()]);

                    return <>{props.children(key(), value())}</>;
                }
            }</Show>

            <Show when={showCaret()}>
                <FaSolidAngleDown class={css.caret} />
            </Show>
        </button>

        <dialog ref={setDialog} id={`${props.id}_dialog`} anchor={`${props.id}_button`} popover class={css.dialog} onToggle={e => setOpen(e.newState === 'open')}>
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
                            dialog()?.hidePopover();
                        }}>{props.children(k, v)}</span>;
                    }
                }</For>
            </main>
        </dialog>
    </section>;
}