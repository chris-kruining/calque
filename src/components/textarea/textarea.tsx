import { createEffect, createSignal, on, onMount } from 'solid-js';
import { debounce } from '@solid-primitives/scheduled';
import { createSelection, getTextNodes } from '@solid-primitives/selection';
import { createSource } from '~/features/source';
import css from './textarea.module.css';

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
    const [selection, setSelection] = createSelection();
    const [editorRef, setEditorRef] = createSignal<HTMLElement>();
    let mounted = false;

    const source = createSource(() => props.value);

    createEffect(on(() => [props.oninput, source.in] as const, ([oninput, text]) => {
        if (!mounted) {
            return;
        }

        oninput?.(text);
    }));

    onMount((() => {
        mounted = true;
    }));

    createEffect(() => {
        source.in = props.value;
    });

    const mutate = debounce(() => {
        const [, start, end] = selection();
        const ref = editorRef();

        if (ref) {
            console.log(ref.innerHTML);

            source.out = ref.innerHTML;

            ref.style.height = `1px`;
            ref.style.height = `${2 + ref.scrollHeight}px`;

            setSelection([ref, start, end]);
        }
    }, 300);

    onMount(() => {
        new MutationObserver(mutate).observe(editorRef()!, {
            subtree: true,
            childList: true,
            characterData: true,
        });
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

    return <div
        ref={setEditorRef}
        class={`${css.textarea} ${props.class}`}
        contentEditable
        dir="auto"
        lang={props.lang}
        innerHTML={source.out}
        data-placeholder={props.placeholder ?? ''}
        on:keydown={e => e.stopPropagation()}
        on:pointerdown={e => e.stopPropagation()}
    />;
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