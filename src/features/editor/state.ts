import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { Accessor, createSignal } from "solid-js";
import { unified } from "unified";
import type { Root } from 'hast';

export interface State {
    text: string;
    ast: Root;
}

export const createState = (value: Accessor<string>): State => {
    const [text, setText] = createSignal(value());
    const [ast, setAst] = createSignal(parse(value()));

    return {
        get text() {
            return text();
        },

        set text(next: string) {
            setText(next);
            setAst(parse(next));
        },

        get ast() {
            return ast();
        },

        set ast(next: Root) {
            console.log(stringify(next));

            setText(stringify(next));
            setAst(next);
        },
    };
};

const stringifyProcessor = unified().use(rehypeStringify)
const parseProcessor = unified().use(rehypeParse)

const stringify = (root: Root) => stringifyProcessor.stringify(root);
const parse = (text: string) => parseProcessor.parse(text);