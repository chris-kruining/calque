import { createEffect, createMemo, createSignal, untrack } from "solid-js";
import { debounce } from "@solid-primitives/scheduled";
import { Editor, Index_Range, splitBy, createElement, useEditor, mergeNodes } from "~/features/editor";
import { visitParents } from "unist-util-visit-parents";
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
            <Editor value={untrack(value)} oninput={setValue}>
                <Toolbar />
                <SearchAndReplace />
            </Editor>
        </div>
    </div>;
}

function Toolbar() {
    const { mutate, selection } = useEditor();

    const trimWhitespaceOn = ({ startNode: startContainer, endNode: endContainer, startOffset, endOffset, ...rest }: Index_Range): Index_Range => {
        const matchStart = startContainer.value.slice(startOffset).match(/^(\s+).*?$/);
        const matchEnd = endContainer.value.slice(0, endOffset).match(/^.*?(\s+)$/);

        return {
            startNode: startContainer,
            startOffset: startOffset + (matchStart?.[1].length ?? 0),
            endNode: endContainer,
            endOffset: endOffset - (matchEnd?.[1].length ?? 0),
            ...rest
        };
    };

    const bold = () => {
        const range = selection();

        if (!range) {
            return;
        }

        mutate((ast) => {
            const { startNode, endNode, startOffset, endOffset, commonAncestor } = trimWhitespaceOn(range);

            const [left, toBold, right] = splitBy(commonAncestor(), [
                { node: startNode, offset: startOffset },
                { node: endNode, offset: endOffset },
            ]);

            console.log(left, toBold, right);
            const boldedElement = createElement('strong', toBold.flatMap(child => child.tagName === 'strong' ? mergeNodes(child.children) : child)) as hast.RootContent;

            // THIS IS WHERE I LEFT OFF
            // AST needs to be clean!!!!

            commonAncestor().children = [...left, boldedElement, ...right];

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