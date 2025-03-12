import { createSignal, untrack } from "solid-js";
import { debounce } from "@solid-primitives/scheduled";
import { Textarea } from "~/components/textarea";
import css from './textarea.module.css';

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
        <Textarea class={css.textarea} title="html" value={value()} oninput={setValue} lang="en-GB" />
    </div>;
}