import { createEffect, createMemo, createSignal, onMount, untrack } from "solid-js";
import { debounce } from "@solid-primitives/scheduled";
import { Editor, useEditor } from "~/features/editor";
import css from './editor.module.css';
import { assert } from "~/utilities";

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

    const onInput = (e: InputEvent) => {
        setValue((e.target! as HTMLTextAreaElement).value);
    };

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
    const { selection } = useEditor();

    const bold = () => {
        const range = untrack(selection)!;

        console.log(range);

        if (range.startContainer.nodeType !== Node.TEXT_NODE) {
            return;
        }

        if (range.endContainer.nodeType !== Node.TEXT_NODE) {
            return;
        }

        // Trim whitespace
        {
            const text = range.toString();
            range.setStart(range.startContainer, range.startOffset + (text.match(/^\s+/)?.[0].length ?? 0));
            range.setEnd(range.endContainer, range.endOffset - (text.match(/\s+$/)?.[0].length ?? 0));
        }

        const fragment = range.extractContents();

        if (range.startContainer === range.commonAncestorContainer && range.endContainer === range.commonAncestorContainer && range.commonAncestorContainer.parentElement?.tagName === 'STRONG') {
            range.selectNode(range.commonAncestorContainer.parentElement);
            range.insertNode(fragment);
        }
        else {
            const strong = document.createElement('strong');
            strong.append(fragment);

            range.insertNode(strong);
            range.selectNode(strong);
        }
    };

    onMount(() => {
        queueMicrotask(() => {
            // bold();
        });
    });

    return <div class={css.toolbar}>
        <button onclick={bold}>bold</button>
    </div>;
}

function SearchAndReplace() {
    const { source } = useEditor();
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

        console.log(source.queryResults);

        // mutate(text => text.replaceAll(query(), replacement()));
    };

    return <form on:submit={replace} class={css.search} popover="manual">
        <label><span>Case insensitive</span><input type="checkbox" checked={caseInsensitive()} oninput={e => setCaseInsensitive(e.target.checked)} /></label>
        <label><span>Search for</span><input type="search" title="editor-search" oninput={e => setTerm(e.target.value)} /></label>
        <label><span>Replace with</span><input type="search" title="editor-replace" oninput={e => setReplacement(e.target.value)} /></label>

        <button>replace</button>
    </form>;
};