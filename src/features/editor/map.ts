import type { Root, Text } from 'hast';
import { getTextNodes } from '@solid-primitives/selection';
import { Accessor, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import { visit } from 'unist-util-visit';

export type IndexNode = { node: Text, dom: Node, text: { start: number, end: number }, html: { start: number, end: number } };
export type IndexMap = IndexNode[];
export type IndexRange = [IndexNode, IndexNode] | [undefined, undefined];

export function createMap(root: Accessor<Element | undefined>, ast: Accessor<Root>) {
    const mapping = createMemo(() => {
        const node = root();
        const tree = ast();

        if (node === undefined) {
            return new WeakMap();
        }

        console.warn('recalculating map');

        return createMapping(node, tree);
    });

    return {
        query: (range: Range) => {
            return [
                mapping().get(range.startContainer),
                mapping().get(range.endContainer),
            ];
        },
    };
}

const createMapping = (root: Node, ast: Root): WeakMap<Node, { start: number, end: number }> => {
    const nodes = getTextNodes(root);
    const map = new WeakMap();

    visit(ast, (n): n is Text => n.type === 'text', (node) => {
        map.set(nodes.shift()!, { start: node.position!.start.offset, end: node.position!.end.offset, text: node.value })
    });

    return map;
};