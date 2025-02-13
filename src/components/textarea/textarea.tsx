import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { decode } from '~/utilities';
import { debounce } from '@solid-primitives/scheduled';
import { createSelection } from '@solid-primitives/selection';
import { defaultChecker as spellChecker } from './spellChecker';
import { defaultChecker as grammarChecker } from './grammarChecker';
import css from './textarea.module.css';

interface TextareaProps {
    class?: string;
    value: string;
    lang: string;
    oninput?: (event: InputEvent) => any;
    spellChecker?: any;
    grammarChecker?: any;
}

export function Textarea(props: TextareaProps) {
    const [selection, setSelection] = createSelection();
    const [value, setValue] = createSignal<string>(decode(props.value));
    const [element, setElement] = createSignal<HTMLTextAreaElement>();

    createEffect(() => {
        setValue(decode(props.value));
    });

    createEffect(() => {
        // For tracking
        value();

        const root = untrack(() => element());
        const [el, start, end] = untrack(() => selection());

        if (el !== root) {
            return;
        }

        // TODO :: this needs to be calculated based on the modification done
        const offset = 1;

        setSelection([el, start + offset, end + offset]);
    });

    const resize = () => {
        const el = element();

        if (!el) {
            return;
        }

        el.style.height = `1px`;
        el.style.height = `${2 + element()!.scrollHeight}px`;
    };

    const mutate = debounce(() => {
        props.oninput?.(new InputEvent('input', {
            data: value(),
        }))
    }, 300);

    const onKeyUp = (e: KeyboardEvent) => {
        e.stopPropagation();
        e.preventDefault();

        setValue(element()!.textContent!);

        resize();
        mutate();

        return false;
    };

    // const spellingErrors = createMemo(() => spellChecker(value(), props.lang));
    // const grammarErrors = createMemo(() => grammarChecker(value(), props.lang));
    const spellingErrors = createMemo(() => []);
    const grammarErrors = createMemo(() => []);

    const html = createMemo(() => {
        return value().split('').map((letter, index) => {
            const spellingOpen = spellingErrors().some(([start]) => start === index) ? `<span class="${css.spellingError}">` : '';
            const spellingClose = spellingErrors().some(([, end]) => end === index) ? `</span>` : '';

            const grammarOpen = grammarErrors().some(([start]) => start === index) ? `<span class="${css.grammarError}">` : '';
            const grammarClose = grammarErrors().some(([, end]) => end === index) ? `</span>` : '';

            return `${grammarOpen}${spellingOpen}${letter}${spellingClose}${grammarClose}`;
        }).join('');
    });

    return <div
        ref={setElement}
        class={`${css.textarea} ${props.class}`}
        lang={props.lang}
        dir="auto"
        onkeyup={onKeyUp}
        on:keydown={e => e.stopPropagation()}
        on:pointerdown={e => e.stopPropagation()}
        contentEditable
        innerHTML={html()}
    />;
}