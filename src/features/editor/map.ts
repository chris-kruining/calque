import type { Root, Text } from 'hast';
import { getTextNodes } from '@solid-primitives/selection';
import { Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { visit } from 'unist-util-visit';

export type IndexNode = { node: Text, dom: Node, text: { start: number, end: number }, html: { start: number, end: number }, offset: number };
export type IndexMap = IndexNode[];
export type IndexRange = [IndexNode, IndexNode] | [undefined, undefined];

export function createMap(root: Accessor<Element | undefined>, ast: Accessor<Root>) {
    // Observe the element so that the references to the nodes in the indices are updated if the DOM is changed
    const latestMutations = observe(root);

    const indices = createMemo(() => {
        const [node] = latestMutations();

        if (node === undefined) {
            return [];
        }

        return createIndices(node, ast());
    });

    return {
        atHtmlPosition(range: Range): IndexRange {
            const start = { ...(indices().find(({ dom }) => dom === range.startContainer)!) };
            const end = indices().find(({ dom }) => dom === range.endContainer);

            if (!start || !end) {
                return [undefined, undefined];
            }

            start.offset = range.startOffset;
            end.offset = range.endOffset;

            return [start, end];
        },

        atTextPosition(start: number, end: number): IndexRange {
            const startNode = { ...(indices().find(({ html }) => html.start <= start && html.end >= start)!) };
            const endNode = indices().find(({ html }) => html.start <= end && html.end >= end);

            if (!startNode || !endNode) {
                return [undefined, undefined];
            }

            startNode.offset = start - startNode.html.start;
            endNode.offset = end - endNode.html.start;

            return [startNode, endNode];
        },

        toTextIndices(range: Range): [number, number] {
            const [startNode, endNode] = this.atHtmlPosition(range);

            return [
                startNode ? (startNode.text.start + range.startOffset) : -1,
                endNode ? (endNode.text.start + range.endOffset) : -1
            ];
        },

        toHtmlIndices(range: Range): [number, number] {
            const [startNode, endNode] = this.atHtmlPosition(range);

            return [
                startNode ? (startNode.html.start + range.startOffset) : -1,
                endNode ? (endNode.html.start + range.endOffset) : -1
            ];
        },

        toRange(start: number, end: number): Range {
            const [startNode, endNode] = this.atTextPosition(start, end);
            const range = new Range();

            if (startNode) {
                range.setStart(startNode.dom, startNode.offset);
            }

            if (endNode) {
                range.setEnd(endNode.dom, endNode.offset);
            }

            return range;
        },
    };
}

const createIndices = (root: Node, ast: Root): IndexMap => {
    const nodes = getTextNodes(root);
    const indices: IndexMap = [];

    let index = 0;
    visit(ast, (n): n is Text => n.type === 'text', (node) => {
        const { position, value } = node as Text;
        const end = index + value.length;

        if (position) {
            indices.push({ node, dom: nodes.shift()!, text: { start: index, end }, html: { start: position.start.offset!, end: position.end.offset! }, offset: 0 });
        }

        index = end;
    });

    return indices;
};

const observe = (node: Accessor<Node | undefined>): Accessor<readonly [Node | undefined, MutationRecord[]]> => {
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

    return createMemo(() => [node(), mutations()] as const);
};