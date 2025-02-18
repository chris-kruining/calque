import { Accessor, Component, createContext, createEffect, createMemo, createSignal, For, onMount, untrack, useContext } from 'solid-js';
import { debounce } from '@solid-primitives/scheduled';
import { createSelection } from '@solid-primitives/selection';
import { createSource } from '~/features/source';
import { isServer } from 'solid-js/web';
import css from './textarea.module.css';

interface TextareaProps {
    class?: string;
    value: string;
    lang: string;
    placeholder?: string;
    oninput?: (next: string) => any;
    spellChecker?: any;
    grammarChecker?: any;
}

export function Textarea(props: TextareaProps) {
    const [selection, setSelection] = createSelection();
    const [editorRef, setEditorRef] = createSignal<HTMLElement>();

    const source = createSource(props.value);

    createEffect(() => {
        props.oninput?.(source.in);
    });

    createEffect(() => {
        source.in = props.value;
    });

    const mutate = debounce(() => {
        const [el, start, end] = selection();
        const ref = editorRef();

        if (ref) {
            source.out = ref.innerHTML;

            ref.style.height = `1px`;
            ref.style.height = `${2 + ref.scrollHeight}px`;

            setSelection([ref, start, end]);
        }
    }, 300);

    onMount(() => {
        const ref = editorRef()!;

        console.log(EditContext);

        const context = new EditContext({
            text: source.out,
        });

        const sub = (event) => context.addEventListener(event, (e: Event) => console.log(event, e));

        sub('textupdate');
        sub('textformatupdate');
        sub('characterboundupdate');

        console.log(context);

        ref.editContext = context;

        const resize = () => context.updateControlBounds(ref.getBoundingClientRect());

        window.addEventListener('resize', resize);
        resize();

        // new MutationObserver(mutate).observe(ref, {
        //     subtree: true,
        //     childList: true,
        //     characterData: true,
        // });
    });

    return <>
        <Suggestions />
        <div
            ref={setEditorRef}
            class={`${css.textarea} ${props.class}`}
            dir="auto"
            lang={props.lang}
            innerHTML={source.out}
            data-placeholder={props.placeholder ?? ''}
            on:keydown={e => e.stopPropagation()}
            on:pointerdown={e => e.stopPropagation()}
        />
    </>;
}

const Suggestions: Component = () => {
    const [selection] = createSelection();
    const [suggestionRef, setSuggestionRef] = createSignal<HTMLElement>();
    const [suggestions, setSuggestions] = createSignal<string[]>([]);

    const marker = createMemo(() => {
        if (isServer) {
            return;
        }

        const [n] = selection();
        const s = window.getSelection();

        if (n === null || s === null || s.rangeCount < 1) {
            return;
        }

        return (findMarkerNode(s.getRangeAt(0)?.commonAncestorContainer) ?? undefined) as HTMLElement | undefined;
    });

    createEffect<HTMLElement | undefined>((prev) => {
        if (prev) {
            prev.style.setProperty('anchor-name', null);
        }

        const m = marker();
        const ref = untrack(() => suggestionRef()!);

        if (m === undefined) {
            ref.hidePopover();

            return;
        }

        m.style.setProperty('anchor-name', '--suggestions');
        ref.showPopover();
        ref.focus()

        return m;
    });

    createEffect(() => {
        marker();

        setSuggestions(Array(Math.ceil(Math.random() * 5)).fill('').map((_, i) => `suggestion ${i}`));
    });

    const onPointerDown = (e: PointerEvent) => {
        marker()?.replaceWith(document.createTextNode(e.target.textContent));
    };

    const onKeyDown = (e: KeyboardEvent) => {
        console.log(e);
    }

    return <menu ref={setSuggestionRef} class={css.suggestions} popover="manual" onkeydown={onKeyDown}>
        <For each={suggestions()}>{
            suggestion => <li onpointerdown={onPointerDown}>{suggestion}</li>
        }</For>
    </menu>;
};

const findMarkerNode = (node: Node | null) => {
    while (node !== null) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).hasAttribute('data-marker')) {
            break;
        }

        node = node.parentNode;
    }

    return node;
};