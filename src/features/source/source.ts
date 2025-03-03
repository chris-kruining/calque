import { Accessor, createEffect, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { unified } from 'unified'
import { visit } from "unist-util-visit";
import { decode } from "~/utilities";
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkStringify from 'remark-stringify'
import rehypeParse from 'rehype-parse'
import rehypeDomParse from 'rehype-dom-parse'
import rehypeRemark from 'rehype-remark'
import rehypeStringify from 'rehype-stringify'
import type { Text, Root } from 'hast'
import { isServer } from "solid-js/web";

interface SourceStore {
    in: string;
    out: string;
    plain: string;
    query: RegExp;
    metadata: {
        spellingErrors: [number, number][];
        grammarErrors: [number, number][];
        queryResults: [number, number][];
    };
}

export interface Source {
    in: string;
    out: string;
    query: RegExp;
    readonly spellingErrors: [number, number][];
    readonly grammarErrors: [number, number][];
    readonly queryResults: [number, number][];
}

// TODO :: make this configurable, right now we can only do markdown <--> html.
const inToOutProcessor = unified().use(remarkParse).use(remarkRehype).use(rehypeStringify);
const outToInProcessor = unified().use(isServer ? rehypeParse : rehypeDomParse).use(rehypeRemark).use(remarkStringify, { bullet: '-' });

export function createSource(value: Accessor<string>): Source {
    const [store, setStore] = createStore<SourceStore>({ in: '', out: '', plain: '', query: new RegExp('', 'gi'), metadata: { spellingErrors: [], grammarErrors: [], queryResults: [] } });

    const src: Source = {
        get in() {
            return store.in;
        },
        set in(next) {
            const ast = inToOutProcessor.runSync(inToOutProcessor.parse(next));

            setStore({
                in: next,
                out: String(inToOutProcessor.stringify(ast)),
                plain: String(unified().use(plainTextStringify).stringify(ast)),
            });
        },

        get out() {
            return store.out;
        },
        set out(next) {
            const ast = outToInProcessor.parse(next);

            setStore({
                in: String(outToInProcessor.stringify(outToInProcessor.runSync(ast))).trim(),
                out: next,
                plain: String(unified().use(plainTextStringify).stringify(ast)),
            });
        },

        get query() {
            return store.query;
        },
        set query(next) {
            setStore('query', next)
        },

        get spellingErrors() {
            return store.metadata.spellingErrors;
        },

        get grammarErrors() {
            return store.metadata.grammarErrors;
        },

        get queryResults() {
            return store.metadata.queryResults;
        },
    };

    createEffect(() => {
        src.in = value();
    });
    src.in = value();

    createEffect(() => {
        const value = store.plain;

        setStore('metadata', {
            spellingErrors: spellChecker(value, ''),
            grammarErrors: grammarChecker(value, ''),
        });
    });

    createEffect(() => {
        setStore('metadata', 'queryResults', findMatches(store.plain, store.query));
    });

    return src;
}

function plainTextStringify() {
    this.compiler = function (tree: Root) {
        const nodes: string[] = [];

        visit(tree, n => n.type === 'text', (n) => {
            nodes.push((n as Text).value);
        });

        return decode(nodes.join(''));
    };
}

function findMatches(text: string, query: RegExp): [number, number][] {
    return text.matchAll(query).map<[number, number]>(({ 0: match, index }) => {
        return [index, index + match.length];
    }).toArray();
}

const spellChecker = checker(/\w+/gi);
const grammarChecker = checker(/\w+\s+\w+/gi);

function checker(regex: RegExp) {
    return (subject: string, lang: string): [number, number][] => {
        return [];

        const threshold = .75//.99;

        return Array.from<RegExpExecArray>(subject.matchAll(regex)).filter(() => Math.random() >= threshold).map(({ 0: match, index }) => {
            return [index, index + match.length] as const;
        });
    }
}