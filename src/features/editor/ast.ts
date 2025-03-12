import type { Node, Text, Parent, RootContent } from 'hast';
import { find } from 'unist-util-find';
import { visit } from 'unist-util-visit';
import { hash } from './temp';

export const createElement = (tagName: string, children: any[], properties: object = {}) => ({ type: 'element', tagName, children, properties });

interface SplitPoint {
    node: Text;
    offset: number;
}

export const splitBy = (tree: Parent, splitPoints: SplitPoint[]): RootContent[][] => {
    const result: RootContent[][] = [];
    let remaining: RootContent[] = Object.hasOwn(tree, 'children') ? (tree as Parent).children : [];

    console.log('kaas');
    // console.log(Object.groupBy(splitPoints, p => hash(p.node)));

    for (const { node, offset } of splitPoints) {
        const index = remaining.findIndex(c => find(c, n => equals(n, node)));

        if (index === -1) {
            throw new Error('The tree does not contain the given node');
        }

        const [targetLeft, targetRight] = splitNode(remaining[index], node, offset);

        const left = remaining.slice(0, index);
        const right = remaining.slice(index + 1);

        if (targetLeft) {
            left.push(targetLeft);
        }

        if (targetRight) {
            right.unshift(targetRight);
        }

        remaining = right;
        result.push(left);
    }

    result.push(remaining);

    return result;
};

const splitNode = (node: Node, text: Text, offset: number): [RootContent | undefined, RootContent | undefined] => {
    if (offset === 0) {
        return [undefined, node as RootContent];
    }

    if (offset === text.value.length) {
        return [node as RootContent, undefined];
    }

    const left = structuredClone(node) as RootContent;
    const right = node as RootContent;

    visit(left, (n): n is Text => equals(n, text), n => {
        n.value = n.value.slice(0, offset);
    })

    visit(right, (n): n is Text => equals(n, text), n => {
        n.value = n.value.slice(offset);
    })

    return [left, right];
}

export const mergeNodes = (...nodes: Text[]): Text => {
    return { type: 'text', value: nodes.map(n => n.value).join() };
};

const equals = (a: Node, b: Node): boolean => {
    if (a === b) {
        return true;
    }

    if (a.type !== b.type) {
        return false;
    }

    return hash(a) === hash(b);
};