import type { Root, Text } from 'hast';
import { getTextNodes } from '@solid-primitives/selection';
import { Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { visit } from 'unist-util-visit';

type IndexNode = { node: Node, text: { start: number, end: number }, html: { start: number, end: number } };
type IndexMap = IndexNode[];

export function createMap(root: Accessor<Element | undefined>, ast: Accessor<Root>) {
    // Observe the element so that the references to the nodes in the indices are updated if the DOM is changed
    const latestMutations = observe(root);

    const indices = createMemo(() => {
        latestMutations();

        const node = root();

        if (node === undefined) {
            return [];
        }

        return createIndices(node, ast());
    });

    return {
        atHtmlPosition(index: number) {
            return indices().find(({ html }) => html.start <= index && html.end >= index);
        },

        toTextIndices(range: Range): [number, number] {
            const startNode = indices().find(({ node }) => node === range.startContainer);
            const endNode = indices().find(({ node }) => node === range.endContainer);

            return [
                startNode ? (startNode.text.start + range.startOffset) : -1,
                endNode ? (endNode.text.start + range.endOffset) : -1
            ];
        },

        toHtmlIndices(range: Range): [number, number] {
            const startNode = indices().find(({ node }) => node === range.startContainer);
            const endNode = indices().find(({ node }) => node === range.endContainer);

            return [
                startNode ? (startNode.html.start + range.startOffset) : -1,
                endNode ? (endNode.html.start + range.endOffset) : -1
            ];
        },

        toRange(start: number, end: number): Range {
            const startNode = indices().find(({ html }) => html.start <= start && html.end >= start);
            const endNode = indices().find(({ html }) => html.start <= end && html.end >= end);

            const range = new Range();

            if (startNode) {
                const offset = start - startNode.html.start;

                range.setStart(startNode.node, offset);
            }

            if (endNode) {
                const offset = end - endNode.html.start;

                range.setEnd(endNode.node, offset);
            }

            return range;
        },
    };
}

const createIndices = (root: Node, ast: Root): IndexMap => {
    const nodes = getTextNodes(root);
    const indices: IndexMap = [];

    let index = 0;
    visit(ast, n => n.type === 'text', (node) => {
        const { position, value } = node as Text;
        const end = index + value.length;

        if (position) {
            indices.push({ node: nodes.shift()!, text: { start: index, end }, html: { start: position.start.offset!, end: position.end.offset! } });
        }

        index = end;
    });

    return indices;
};

const observe = (node: Accessor<Node | undefined>): Accessor<MutationRecord[]> => {
    const [mutations, setMutations] = createSignal<MutationRecord[]>([]);

    const observer = new MutationObserver(records => {
        setMutations(records);
    });

    createEffect(() => {
        const n = node();

        observer.disconnect();

        if (n) {
            observer.observe(n, { characterData: true, subtree: true, childList: true });
        }
    });

    onCleanup(() => {
        observer.disconnect();
    });

    return mutations;
};