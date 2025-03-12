import type { Root, Text } from 'hast';
import { getTextNodes } from '@solid-primitives/selection';
import { Accessor, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { visit } from 'unist-util-visit';

export type IndexNode = { node: Text, dom: Node, text: { start: number, end: number }, html: { start: number, end: number } };
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
        query(range: Range): [IndexNode | undefined, IndexNode | undefined] {
            return [
                indices().find(({ dom }) => dom === range.startContainer),
                indices().find(({ dom }) => dom === range.endContainer),
            ];
        },

        atHtmlPosition(start: number, end: number): IndexRange {
            const startNode = indices().find(({ html }) => html.start <= start && html.end >= start);
            const endNode = indices().find(({ html }) => html.start <= end && html.end >= end);

            if (!startNode || !endNode) {
                return [undefined, undefined];
            }

            return [startNode, endNode];
        },

        atTextPosition(start: number, end: number): IndexRange {
            const startNode = indices().find(({ text }) => text.start <= start && text.end >= start);
            const endNode = indices().find(({ text }) => text.start <= end && text.end >= end);

            if (!startNode || !endNode) {
                return [undefined, undefined];
            }

            return [startNode, endNode];
        },

        toTextIndices(range: Range): [number, number] {
            const [startNode, endNode] = this.query(range);

            return [
                startNode ? (startNode.text.start + range.startOffset) : -1,
                endNode ? (endNode.text.start + range.endOffset) : -1
            ];
        },

        toHtmlIndices(range: Range): [number, number] {
            const [startNode, endNode] = this.query(range);

            return [
                startNode ? (startNode.html.start + range.startOffset) : -1,
                endNode ? (endNode.html.start + range.endOffset) : -1
            ];
        },

        fromTextIndices(start: number, end: number): Range {
            const [startNode, endNode] = this.atTextPosition(start, end);
            const range = new Range();

            if (startNode) {
                const offset = start - startNode.text.start;

                range.setStart(startNode.dom, offset);
            }

            if (endNode) {
                const offset = end - endNode.text.start;

                console.log('end offset', endNode);

                range.setEnd(endNode.dom, offset);
            }

            return range;
        },

        fromHtmlIndices(start: number, end: number): Range {
            const [startNode, endNode] = this.atHtmlPosition(start, end);
            const range = new Range();

            if (startNode) {
                const offset = start - startNode.html.start;

                range.setStart(startNode.dom, offset);
            }

            if (endNode) {
                const offset = end - endNode.html.start;

                range.setEnd(endNode.dom, offset);
            }

            return range;
        },
    };
}

const createIndices = (root: Node, ast: Root): IndexMap => {
    const nodes = getTextNodes(root);
    const indices: IndexMap = [];

    console.log(ast);

    let index = 0;
    visit(ast, (n): n is Text => n.type === 'text', (node) => {
        const { position, value } = node as Text;
        const end = index + value.length;
        const dom = nodes.shift()!;

        console.log({ value, text: dom?.textContent, dom });

        // if (value.includes('ntains bolded text')) {
        //     console.log(value, dom.textContent, { node, dom });
        // }

        if (position) {
            indices.push({ node, dom, text: { start: index, end }, html: { start: position.start.offset!, end: position.end.offset! } });
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