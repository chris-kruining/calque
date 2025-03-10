import type { Node, Text, Element, ElementContent, Parent, RootContent } from 'hast';
import { find } from 'unist-util-find';
import { visit } from 'unist-util-visit';
import { deepCopy } from '~/utilities';

/**
 * 
 * Given
 * root
 * |- element
 * |  |- text [0, 6]
 * |  |- element
 * |  |  |- text [7, 18]
 * |  |- text [19, 25]
 * |- element
 *    |- text [26, 40]
 *    |- element
 *    |  |- text [41, 53]
 *    |- text [54, 60]
 * 
 * split at 10
 * 
 * root
 * |- element
 * |  |- text [0, 6]
 * |  |- element
 * |  |  |- text [7, 9]
 * 
 * root
 * |- element
 * |  |- element
 * |  |  |- text [10, 18]
 * |  |- text [19, 25]
 * |- element
 *    |- text [26, 40]
 *    |- element
 *    |  |- text [41, 53]
 *    |- text [54, 60]
 */

export const splitAt = (tree: Parent, node: Text, offset: number): [RootContent[], RootContent[]] => {
    const index = tree.children.findIndex(c => find(c, { ...node }));

    if (index === -1) {
        throw new Error('The tree does not contain the given node');
    }

    const left = tree.children.slice(0, index);
    const right = tree.children.slice(index + 1);

    if (offset === 0) {
        right.unshift(tree.children[index]);
    }
    else if (offset === node.value.length) {
        left.push(tree.children[index]);
    }
    else {
        const targetLeft = deepCopy(tree.children[index]);
        const targetRight = tree.children[index];

        left.push(targetLeft);
        right.unshift(targetRight);

        visit(targetLeft, (n): n is Text => equals(n, node), n => {
            n.value = n.value.slice(0, offset);
        })

        visit(targetRight, (n): n is Text => equals(n, node), n => {
            n.value = n.value.slice(offset);
        })
    }

    return [left, right];
};

const splitNode = (node: Node, offset: number) => {

}

const equals = (a: Node, b: Node): boolean => {
    if (a === b) {
        return true;
    }

    if (a.type !== b.type) {
        return false;
    }

    // This is the nasty version of deep object checking, 
    // but I hope this is safe to do in this case because
    // we are working with a html-ast and not just any type of object.
    return JSON.stringify(a) === JSON.stringify(b);
};