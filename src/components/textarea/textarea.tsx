import { Component, createEffect, createMemo, createSignal, For, on, untrack } from 'solid-js';
import { createSelection, getTextNodes } from '@solid-primitives/selection';
import { isServer } from 'solid-js/web';
import { createEditContext } from '~/features/edit-context';
import { createSource } from '~/features/source';
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
    const [editorRef, setEditorRef] = createSignal<HTMLElement>();
    const source = createSource(() => props.value);
    const [text] = createEditContext(editorRef, () => source.out);

    createEffect(() => {
        props.oninput?.(source.in);
    });

    createEffect(on(() => [editorRef(), source.spellingErrors] as const, ([ref, errors]) => {
        createHighlights(ref, 'spelling-error', errors);
    }));

    createEffect(on(() => [editorRef(), source.grammarErrors] as const, ([ref, errors]) => {
        createHighlights(ref, 'grammar-error', errors);
    }));

    createEffect(on(() => [editorRef(), source.queryResults] as const, ([ref, errors]) => {
        createHighlights(ref, 'search-results', errors);
    }));

    return <>
        <Suggestions />
        <input class={css.search} type="search" oninput={e => source.query = e.target.value} />
        <div
            ref={setEditorRef}
            class={`${css.textarea} ${props.class}`}
            dir="auto"
            lang={props.lang}
            innerHTML={text()}
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



const createHighlights = (node: Node, type: string, ranges: [number, number][]) => {
    queueMicrotask(() => {
        const nodes = getTextNodes(node);

        CSS.highlights.set(type, new Highlight(...ranges.map(([start, end]) => indicesToRange(start, end, nodes))));
    });
};

const indicesToRange = (start: number, end: number, textNodes: Node[]) => {
    const [startNode, startPos] = getRangeArgs(start, textNodes);
    const [endNode, endPos] = start === end ? [startNode, startPos] : getRangeArgs(end, textNodes);

    const range = new Range();

    if (startNode && endNode && startPos !== -1 && endPos !== -1) {
        range.setStart(startNode, startPos);
        range.setEnd(endNode, endPos);
    }

    return range;
}

const getRangeArgs = (offset: number, texts: Node[]): [node: Node | null, offset: number] =>
    texts.reduce(
        ([node, pos], text) =>
            node
                ? [node, pos]
                : pos <= (text as Text).data.length
                    ? [text, pos]
                    : [null, pos - (text as Text).data.length],
        [null, offset] as [node: Node | null, pos: number],
    );