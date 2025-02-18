import { onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { unified, Transformer } from 'unified'
import { Node, Text, Element } from 'hast'
import { visit } from "unist-util-visit";
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkStringify from 'remark-stringify'
import rehypeParse from 'rehype-dom-parse'
import rehypeRemark from 'rehype-remark'
import rehypeStringify from 'rehype-dom-stringify'

export interface Source {
    in: string;
    out: string;
}

// TODO :: make this configurable, right now we can only do markdown <--> html.
const inToOutProcessor = unified().use(remarkParse).use(remarkRehype).use(addErrors).use(rehypeStringify);
const outToInProcessor = unified().use(rehypeParse).use(clearErrors).use(rehypeRemark).use(remarkStringify, { bullet: '-' });

export function createSource(initalValue: string): Source {
    const [store, setStore] = createStore({ in: initalValue, out: '' });

    onMount(() => {
        setStore('out', String(inToOutProcessor.processSync(initalValue)));
    });

    return {
        get in() {
            return store.in;
        },
        set in(next) {
            setStore({
                in: next,
                out: String(inToOutProcessor.processSync(next)),
            });
        },

        get out() {
            return store.out;
        },
        set out(next) {
            setStore({
                in: String(outToInProcessor.processSync(next)).trim(),
                out: next,
            });
        },
    };
}

const isMarker = (node: Node) => node.type === 'element' && Object.hasOwn((node as Element).properties, 'dataMarker')

function addErrors(): Transformer {
    const wrapInMarker = (text: Text, type: string): Element => ({
        type: 'element',
        tagName: 'span',
        properties: {
            dataMarker: type,
        },
        children: [
            text
        ]
    });

    return function (tree) {
        visit(tree, n => n.type === 'text', (n, i, p: Element) => {
            if (typeof i !== 'number' || p === undefined) {
                return;
            }

            if (isMarker(p)) {
                return;
            }

            const errors = grammarChecker(n.value, 'en-GB');

            if (errors.length === 0) {
                return;
            }

            p.children.splice(i, 1, ...errors.map(([isHit, value]) => {
                const textNode: Text = { type: 'text', value };

                return isHit ? wrapInMarker(textNode, 'grammar') : textNode;
            }))
        });

        visit(tree, n => n.type === 'text', (n, i, p: Element) => {
            if (typeof i !== 'number' || p === undefined) {
                return;
            }

            if (isMarker(p)) {
                return;
            }

            const errors = spellChecker(n.value, 'en-GB');

            if (errors.length === 0) {
                return;
            }

            p.children.splice(i, 1, ...errors.map(([isHit, value]) => {
                const textNode: Text = { type: 'text', value };

                return isHit ? wrapInMarker(textNode, 'spelling') : textNode;
            }))
        });
    }
}

function clearErrors(): Transformer {
    return function (tree) {
        visit(tree, isMarker, (n, i, p: Element) => {
            if (typeof i !== 'number' || p === undefined) {
                return;
            }

            p.children.splice(i, 1, ...(n as Element).children);
        })
    }
}

const spellChecker = checker(/\w+/gi);
const grammarChecker = checker(/\w+\s+\w+/gi);

function checker(regex: RegExp) {
    return (subject: string, lang: string): (readonly [boolean, string])[] => {
        return [];

        let lastIndex = 0;
        const threshold = .75//.99;

        return Array.from<RegExpExecArray>(subject.matchAll(regex)).filter(() => Math.random() >= threshold).flatMap<readonly [boolean, string]>(({ 0: match, index }) => {
            const end = index + match.length;
            const result = [
                [false, subject.slice(lastIndex, index)],
                [true, subject.slice(index, end)],
            ] as const;

            lastIndex = end;

            return result;
        }).concat([[false, subject.slice(lastIndex, subject.length)]]);
    }
}