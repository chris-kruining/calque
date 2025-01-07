import { createMemo, createSignal, For, JSX, Setter, createEffect, Show } from "solid-js";
import css from './index.module.css';
import { FaSolidAngleDown } from "solid-icons/fa";

interface DropdownProps<T, K extends string> {
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

export function Dropdown<T, K extends string>(props: DropdownProps<T, K>) {
    const [dialog, setDialog] = createSignal<HTMLDialogElement>();
    const [value, setValue] = createSignal<K>(props.value);
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
        props.setValue?.(() => value());
    });

    createEffect(() => {
        dialog()?.[open() ? 'showPopover' : 'hidePopover']();
    });

    return <section class={`${css.box} ${props.class}`}>
        <button id={`${props.id}_button`} popoverTarget={`${props.id}_dialog`} class={css.button}>
            {props.children(value(), props.values[value()])}

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
                        const selected = createMemo(() => value() === k);

                        return <span class={`${css.option} ${selected() ? css.selected : ''}`} onpointerdown={() => {
                            setValue(() => k);
                            dialog()?.hidePopover();
                        }}>{props.children(k, v)}</span>;
                    }
                }</For>
            </main>
        </dialog>
    </section>;
}