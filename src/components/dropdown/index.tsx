import { createMemo, createSignal, For, JSX, Setter, createEffect, Show, ParentProps, children } from "solid-js";
import { FaSolidAngleDown } from "solid-icons/fa";
import css from './index.module.css';

export interface DropdownApi {
    show(): void;
    hide(): void;
}

interface DropdownProps {
    api?: (api: DropdownApi) => any,
    id: string;
    class?: string;
    open?: boolean;
    showCaret?: boolean;
    text: JSX.Element;
    children: JSX.Element;
}

export function Dropdown(props: DropdownProps) {
    const [dialog, setDialog] = createSignal<HTMLDialogElement>();
    const [open, setOpen] = createSignal<boolean>(props.open ?? false);

    const showCaret = createMemo(() => props.showCaret ?? true);

    createEffect(() => {
        dialog()?.[open() ? 'showPopover' : 'hidePopover']();
    });

    createEffect(() => {
        props.api?.({
            show() {
                dialog()?.showPopover();
            },
            hide() {
                dialog()?.hidePopover();
            },
        });
    });

    return <section class={`${css.box} ${props.class}`}>
        <button id={`${props.id}_button`} popoverTarget={`${props.id}_dialog`} class={css.button}>
            {props.text}

            <Show when={showCaret()}>
                <FaSolidAngleDown class={css.caret} />
            </Show>
        </button>

        <dialog ref={setDialog} id={`${props.id}_dialog`} anchor={`${props.id}_button`} popover class={css.dialog} onToggle={e => setOpen(e.newState === 'open')}>
            {props.children}
        </dialog>
    </section>;
}