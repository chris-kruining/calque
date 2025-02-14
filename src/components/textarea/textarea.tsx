import { createEffect, createMemo, untrack } from 'solid-js';
import { debounce } from '@solid-primitives/scheduled';
import { createSelection } from '@solid-primitives/selection';
import { defaultChecker as spellChecker } from './spellChecker';
import { defaultChecker as grammarChecker } from './grammarChecker';
import { createSource } from '~/features/source';
import css from './textarea.module.css';

interface TextareaProps {
    class?: string;
    value: string;
    lang: string;
    placeholder?: string;
    oninput?: (next: string) => any;
    spellChecker?: any;
    grammarChecker?: any;
}

export function Textarea(props: TextareaProps) {
    const [selection, setSelection] = createSelection();

    const source = createSource(props.value);

    createEffect(() => {
        props.oninput?.(source.in);
    });

    createEffect(() => {
        source.in = props.value;
    });

    const onInput = debounce(() => {
        const [el, start, end] = untrack(() => selection());

        if (el) {
            source.out = el.innerHTML;

            el.style.height = `1px`;
            el.style.height = `${2 + el.scrollHeight}px`;

            setSelection([el, start, end]);
        }
    }, 300);

    const spellingErrors = createMemo(() => spellChecker(source.out, props.lang));
    const grammarErrors = createMemo(() => grammarChecker(source.out, props.lang));

    // const html = createMemo(() => {
    //     return source.out.split('').map((letter, index) => {
    //         const spellingOpen = spellingErrors().some(([start]) => start === index) ? `<span class="${css.spellingError}">` : '';
    //         const spellingClose = spellingErrors().some(([, end]) => end === index) ? `</span>` : '';

    //         const grammarOpen = grammarErrors().some(([start]) => start === index) ? `<span class="${css.grammarError}">` : '';
    //         const grammarClose = grammarErrors().some(([, end]) => end === index) ? `</span>` : '';

    //         return `${grammarOpen}${spellingOpen}${letter}${spellingClose}${grammarClose}`;
    //     }).join('');
    // });

    return <div
        class={`${css.textarea} ${props.class}`}
        contentEditable
        dir="auto"
        lang={props.lang}
        oninput={onInput}
        innerHTML={source.out}
        data-placeholder={props.placeholder ?? ''}
        on:keydown={e => e.stopPropagation()}
        on:pointerdown={e => e.stopPropagation()}
    />;
}