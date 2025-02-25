import { Component, createEffect, createMemo, createSignal, For, on, untrack } from 'solid-js';
import { createSelection, getTextNodes } from '@solid-primitives/selection';
import { isServer } from 'solid-js/web';
import { createEditContext } from '~/features/editor';
import { createSource } from '~/features/source';
import css from './textarea.module.css';
import { debounce } from '@solid-primitives/scheduled';

interface TextareaProps {
    class?: string;
    title?: string;
    value: string;
    lang: string;
    placeholder?: string;
    oninput?: (next: string) => any;
    spellChecker?: any;
    grammarChecker?: any;
}

export function Textarea(props: TextareaProps) {
    const [replacement, setReplacement] = createSignal('');
    const [editorRef, setEditorRef] = createSignal<HTMLElement>();

    const source = createSource(() => props.value);
    const [text, { mutate }] = createEditContext(editorRef, () => source.out);

    createEffect(() => {
        source.out = text();
    });

    createEffect(() => {
        props.oninput?.(source.in);
    });

    createEffect(on(() => [editorRef()!, source.spellingErrors] as const, ([ref, errors]) => {
        createHighlights(ref, 'spelling-error', errors);
    }));

    createEffect(on(() => [editorRef()!, source.grammarErrors] as const, ([ref, errors]) => {
        createHighlights(ref, 'grammar-error', errors);
    }));

    createEffect(on(() => [editorRef()!, source.queryResults] as const, ([ref, errors]) => {
        createHighlights(ref, 'search-results', errors);
    }));

    const replace = () => {
        mutate(text => text.replaceAll(source.query, replacement()));
    };

    return <>
        <div class={css.search}>
            <input type="search" title={`${props.title ?? ''}-search`} placeholder="search for" oninput={e => source.query = e.target.value} />
            <input type="search" title={`${props.title ?? ''}-replace`} placeholder="replace with" oninput={e => setReplacement(e.target.value)} />
            <button onclick={() => replace()}>replace</button>
        </div>

        <div
            ref={setEditorRef}
            class={`${css.textarea} ${props.class}`}
            title={props.title ?? ''}
            dir="auto"
            lang={props.lang}
            innerHTML={text()}
            data-placeholder={props.placeholder ?? ''}
            on:keydown={e => e.stopPropagation()}
            on:pointerdown={e => e.stopPropagation()}
        />
    </>;
}

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