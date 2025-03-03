import { createContextProvider } from "@solid-primitives/context";
import { Accessor, createEffect, createMemo, createSignal, on, ParentProps, Setter } from "solid-js";
import { createEditor } from "./context";
import { createSource, Source } from "../source";
import { getTextNodes } from "@solid-primitives/selection";
import { isServer } from "solid-js/web";

interface EditorContextType {
    readonly text: Accessor<string>;
    readonly selection: Accessor<Range | undefined>;
    readonly source: Source;
    select(range: Range): void;
    mutate(setter: (prev: string) => string): void;
}

interface EditorContextProps extends Record<string, unknown> {
    ref: Accessor<Element | undefined>;
    value: string;
    oninput?: (value: string) => void;
}

const [EditorProvider, useEditor] = createContextProvider<EditorContextType, EditorContextProps>((props) => {
    const source = createSource(() => props.value);
    const [text, { select, mutate, selection }] = createEditor(props.ref, () => source.out);

    createEffect(() => {
        props.oninput?.(source.in);
    });

    createEffect(() => {
        source.out = text();
    });

    createEffect(on(() => [props.ref()!, source.spellingErrors] as const, ([ref, errors]) => {
        createHighlights(ref, 'spelling-error', errors);
    }));

    createEffect(on(() => [props.ref()!, source.grammarErrors] as const, ([ref, errors]) => {
        createHighlights(ref, 'grammar-error', errors);
    }));

    createEffect(on(() => [props.ref()!, source.queryResults] as const, ([ref, results]) => {
        createHighlights(ref, 'search-results', results);
    }));

    return {
        text,
        select,
        mutate,
        source,
        selection,
    };
}, {
    text: () => '',
    selection: () => undefined,
    source: {} as Source,
    select() { },
    mutate() { },
});

export { useEditor };

export function Editor(props: ParentProps<{ value: string, oninput?: (value: string) => void }>) {
    const [ref, setRef] = createSignal<Element>();

    return <EditorProvider ref={ref} value={props.value} oninput={props.oninput}>
        {props.children}

        <Content ref={setRef} />
    </EditorProvider>;
}

function Content(props: { ref: Setter<Element | undefined> }) {
    const { text } = useEditor();

    return <div ref={props.ref} innerHTML={text()} />;
}

const createHighlights = (node: Node, type: string, indices: [number, number][]) => {
    queueMicrotask(() => {
        const nodes = getTextNodes(node);

        CSS.highlights.set(type, new Highlight(...indices.map(([start, end]) => indicesToRange(start, end, nodes))));
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