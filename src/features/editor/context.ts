import { createEventListenerMap, DocumentEventListener, WindowEventListener } from "@solid-primitives/event-listener";
import { Accessor, createEffect, createMemo, onMount, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";
import { unified } from "unified";
import { createMap } from './map';
import { splice } from "~/utilities";
import rehypeParse from "rehype-parse";

type Editor = [Accessor<string>, { select(range: Range): void, mutate(setter: (text: string) => string): void, readonly selection: Accessor<Range | undefined> }];

interface EditorStoreType {
    text: string;
    isComposing: boolean;
    selection: Range | undefined;
    characterBounds: DOMRect[];
    controlBounds: DOMRect;
    selectionBounds: DOMRect;
}

export function createEditor(ref: Accessor<Element | undefined>, value: Accessor<string>): Editor {
    if (isServer) {
        return [value, {
            select() { },
            mutate() { },
            selection: () => undefined,
        }];
    }

    if (!("EditContext" in window)) {
        throw new Error('`EditContext` is not implemented');
    }

    const context = new EditContext({
        text: value(),
    });

    const [store, setStore] = createStore<EditorStoreType>({
        text: value(),
        isComposing: false,
        selection: undefined,

        // Bounds
        characterBounds: new Array<DOMRect>(),
        controlBounds: new DOMRect(),
        selectionBounds: new DOMRect(),
    });

    const ast = createMemo(() => unified().use(rehypeParse).parse(store.text));
    const indexMap = createMap(() => ref()!, ast);

    createEventListenerMap<any>(context, {
        textupdate(e: TextUpdateEvent) {
            const { updateRangeStart: start, updateRangeEnd: end, text } = e;

            setStore('text', `${store.text.slice(0, start)}${text}${store.text.slice(end)}`);

            context.updateSelection(start + text.length, start + text.length);
        },

        compositionstart() {
            setStore('isComposing', true);
        },

        compositionend() {
            setStore('isComposing', false);
        },

        characterboundsupdate(e: CharacterBoundsUpdateEvent) {
            context.updateCharacterBounds(e.rangeStart, []);
        },

        textformatupdate(e: TextFormatUpdateEvent) {
            const formats = e.getTextFormats();

            for (const format of formats) {
                console.log(format);
            }
        },
    });

    function updateText(start: number, end: number, text: string) {
        context.updateText(start, end, text);

        setStore('text', splice(store.text, start, end, text));

        context.updateSelection(start + text.length, start + text.length);
    }

    function updateControlBounds() {
        context.updateControlBounds(ref()!.getBoundingClientRect());
    }

    function updateSelection(range: Range) {
        context.updateSelection(...indexMap.toHtmlIndices(range));
        context.updateSelectionBounds(range.getBoundingClientRect());

        setStore('selection', range);

        queueMicrotask(() => {
            const selection = window.getSelection();

            if (selection === null) {
                return;
            }

            if (selection.rangeCount !== 0) {
                const existingRange = selection.getRangeAt(0);

                if (equals(range, existingRange)) {
                    return;
                }

                selection.removeAllRanges();
            }

            selection.addRange(range);
        });
    }

    WindowEventListener({
        onresize() {
            updateControlBounds()
        },
    });

    DocumentEventListener({
        onSelectionchange(e) {
            const selection = document.getSelection();

            if (selection === null) {
                return;
            }

            if (selection.rangeCount === 0) {
                return;
            }

            if (document.activeElement !== ref()) {
                return;
            }

            updateSelection(selection.getRangeAt(0)!);
        },
    });

    createEventListenerMap(() => ref()!, {
        keydown(e: KeyboardEvent) {
            // keyCode === 229 is a special code that indicates an IME event.
            // https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime
            if (e.keyCode === 229) {
                return;
            }

            const start = Math.min(context.selectionStart, context.selectionEnd);
            let end = Math.max(context.selectionStart, context.selectionEnd);

            if (e.key === 'Tab') {
                e.preventDefault();

                updateText(start, end, '&nbsp;&nbsp;&nbsp;&nbsp;');
            } else if (e.key === 'Enter') {
                updateText(start, end, '</p><p>&nbsp;');
            }
        },
    });

    onMount(() => {
        updateControlBounds();
    });

    createEffect((last?: Element) => {
        if (last !== undefined) {
            last.editContext = undefined;
        }

        const el = ref();

        if (el === undefined) {
            return;
        }

        el.editContext = context;

        return el;
    });

    createEffect(() => {
        updateText(0, -0, value());
    });

    createEffect(() => {
        store.text;

        if (document.activeElement === untrack(ref)) {
            queueMicrotask(() => {
                console.log();

                updateSelection(indexMap.toRange(context.selectionStart, context.selectionEnd));
            });
        }
    });

    return [
        createMemo(() => store.text),
        {
            select(range: Range) {
                updateSelection(range);
            },

            mutate(setter) {
                setStore('text', setter);
            },

            selection: createMemo(() => store.selection),
        }];
}

const equals = (a: Range, b: Range): boolean => {
    const keys: (keyof Range)[] = ['startOffset', 'endOffset', 'commonAncestorContainer', 'startContainer', 'endContainer'];
    return keys.every(key => a[key] === b[key]);
}

declare global {
    interface Element {
        editContext?: EditContext;
    }

    interface TextFormat {
        readonly rangeStart: number;
        readonly rangeEnd: number;
        readonly underlineStyle: 'none' | 'solid' | 'double' | 'dotted' | 'sadhed' | 'wavy';
        readonly underlineThickness: 'none' | 'thin' | 'thick';
    }

    interface CharacterBoundsUpdateEvent extends Event {
        readonly rangeStart: number;
        readonly rangeEnd: number;
    }

    interface TextFormatUpdateEvent extends Event {
        getTextFormats(): TextFormat[];
    }

    interface TextUpdateEvent extends Event {
        readonly updateRangeStart: number;
        readonly updateRangeEnd: number;
        readonly text: string;
        readonly selectionStart: number;
        readonly selectionEnd: number;
    }

    interface EditContextEventMap {
        characterboundsupdate: CharacterBoundsUpdateEvent;
        compositionstart: Event;
        compositionend: Event;
        textformatupdate: TextFormatUpdateEvent;
        textupdate: TextUpdateEvent;
    }

    interface EditContext extends EventTarget {
        readonly text: string;
        readonly selectionStart: number;
        readonly selectionEnd: number;
        readonly characterBoundsRangeStart: number;

        oncharacterboundsupdate?: (event: CharacterBoundsUpdateEvent) => any;
        oncompositionstart?: (event: Event) => any;
        oncompositionend?: (event: Event) => any;
        ontextformatupdate?: (event: TextFormatUpdateEvent) => any;
        ontextupdate?: (event: TextUpdateEvent) => any;

        attachedElements(): [HTMLElement];
        characterBounds(): DOMRect[];
        updateText(rangeStart: number, rangeEnd: number, text: string): void;
        updateSelection(start: number, end: number): void;
        updateControlBounds(controlBounds: DOMRect): void;
        updateSelectionBounds(selectionBounds: DOMRect): void;
        updateCharacterBounds(rangeStart: number, characterBounds: DOMRect[]): void;

        addEventListener<K extends keyof EditContextEventMap>(type: K, listener: (this: EditContext, ev: EditContextEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    }

    interface EditContextConstructor {
        new(): EditContext;
        new(options: Partial<Pick<EditContext, 'text' | 'selectionStart' | 'selectionEnd'>>): EditContext;
        readonly prototype: EditContext;
    }

    var EditContext: EditContextConstructor;
}