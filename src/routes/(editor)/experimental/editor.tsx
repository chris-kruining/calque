import { createEffect, createMemo, createSignal } from "solid-js";
import { debounce } from "@solid-primitives/scheduled";
import { Editor, splitAt, useEditor } from "~/features/editor";
import { visitParents } from "unist-util-visit-parents";
import findAncestor from 'unist-util-ancestor';
import type * as hast from 'hast';
import css from './editor.module.css';

const tempVal = `
# Header

this is **a string** that contains bolded text

this is *a string* that contains italicized text

> Dorothy followed her through many of the beautiful rooms in her castle.

> #### The quarterly results look great!
>
> - Revenue was off the chart.
> - Profits were higher than ever.
>
> > The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.
>
> *Everything* is going according to **plan**.

- First item
- Second item
- Third item
- Fourth item
`;

export default function Formatter(props: {}) {
    const [value, setValue] = createSignal(tempVal);

    const onInput = debounce((e: InputEvent) => {
        setValue((e.target! as HTMLTextAreaElement).value);
    }, 300);

    return <div class={css.root}>
        <textarea oninput={onInput} title="markdown">{value()}</textarea>

        <div class={css.editor}>
            <Editor value={value()} oninput={setValue}>
                <Toolbar />
                <SearchAndReplace />
            </Editor>
        </div>
    </div>;
}

function Toolbar() {
    const { mutate, selection } = useEditor();

    const matchesAncestor = (tree: hast.Node, node: hast.Text, predicate: (node: hast.Node) => boolean) => {
        let matches = false;

        visitParents(tree, n => n === node, (_, ancestors) => {
            matches = ancestors.some(predicate);
        });

        return matches;
    }

    const bold = () => {
        const [start, end] = selection();

        if (!start || !end) {
            return
        }

        mutate((ast) => {
            console.log(end.node.value.slice(0, end.offset));

            // Trim whitespace from selection
            const matchStart = start.node.value.slice(start.offset).match(/^(\s+).*?$/);
            if (matchStart !== null) {
                start.offset += matchStart[1].length;
            }

            const matchEnd = end.node.value.slice(0, end.offset).match(/^.*?(\s+)$/);
            if (matchEnd !== null) {
                end.offset -= matchEnd[1].length;
            }

            // Edge case Unbold the selected characters
            if (start.node === end.node) {
                visitParents(ast, (n): n is hast.Text => n === start.node, (n, ancestors) => {
                    const [strong, parent] = ancestors.toReversed();

                    if (strong.type === 'element' && strong.tagName === 'strong') {
                        parent.children.splice(parent.children.indexOf(strong as hast.ElementContent), 1,
                            { type: 'element', tagName: 'strong', properties: {}, children: [{ type: 'text', value: n.value.slice(0, start.offset) }] },
                            { type: 'text', value: n.value.slice(start.offset, end.offset) },
                            { type: 'element', tagName: 'strong', properties: {}, children: [{ type: 'text', value: n.value.slice(end.offset) }] },
                        );
                    }
                    else {
                        strong.children.splice(strong.children.indexOf(n), 1,
                            { type: 'text', value: n.value.slice(0, start.offset) },
                            { type: 'element', tagName: 'strong', properties: {}, children: [{ type: 'text', value: n.value.slice(start.offset, end.offset) }] },
                            { type: 'text', value: n.value.slice(end.offset) },
                        );
                    }
                });

                return ast;
            }

            const common = findAncestor(ast, [start.node, end.node] as const) as hast.Element;
            const startIsBold = matchesAncestor(common, start.node, (node) => node.type === 'element' && node.tagName === 'strong');
            const endIsBold = matchesAncestor(common, end.node, (node) => node.type === 'element' && node.tagName === 'strong');

            // Extend to left
            if (startIsBold) {
                start.offset = 0;
            }

            // Extend to right
            if (endIsBold) {
                end.offset = end.node.value.length;
            }

            const [a, b] = splitAt(common, start.node, start.offset);
            const [c, d] = splitAt({ type: 'root', children: b }, end.node, end.offset);
            const boldedElement = { type: 'element', tagName: 'strong', children: c } as hast.RootContent;

            common.children = [...a, boldedElement, ...d] as hast.ElementContent[];

            console.log(c, d, common.children);

            return ast;
        });

    };

    return <div class={css.toolbar}>
        <button onclick={bold}>bold</button>
    </div>;
}

function SearchAndReplace() {
    const { mutate, source } = useEditor();
    const [replacement, setReplacement] = createSignal('');
    const [term, setTerm] = createSignal('');
    const [caseInsensitive, setCaseInsensitive] = createSignal(true);

    const query = createMemo(() => new RegExp(term(), caseInsensitive() ? 'gi' : 'g'));

    createEffect(() => {
        source.query = query();
    });

    const replace = (e: SubmitEvent) => {
        e.preventDefault();

        const form = e.target as HTMLFormElement;
        form.reset();

        mutate(text => text.replaceAll(query(), replacement()));
    };

    return <form on:submit={replace} class={css.search} popover="manual">
        <label><span>Case insensitive</span><input type="checkbox" checked={caseInsensitive()} oninput={e => setCaseInsensitive(e.target.checked)} /></label>
        <label><span>Search for</span><input type="search" title="editor-search" oninput={e => setTerm(e.target.value)} /></label>
        <label><span>Replace with</span><input type="search" title="editor-replace" oninput={e => setReplacement(e.target.value)} /></label>

        <button>replace</button>
    </form>;
};