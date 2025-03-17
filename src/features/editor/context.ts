import { createEventListenerMap, DocumentEventListener, WindowEventListener } from "@solid-primitives/event-listener";
import { Accessor, createEffect, createMemo, createSignal, on, onCleanup, onMount, Setter } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { isServer } from "solid-js/web";
import { createMap } from './map';
import { unified } from "unified";
import rehypeParse from "rehype-parse";

export type SelectFunction = (range: Range) => void;
type Editor = { select: SelectFunction, readonly selection: Accessor<Range | undefined> };

interface EditorStoreType {
    text: string;
    isComposing: boolean;
    selection: Range | undefined;
    characterBounds: DOMRect[];
    controlBounds: DOMRect;
    selectionBounds: DOMRect;
}

export function createEditor(ref: Accessor<Element | undefined>, value: Accessor<string>, setValue: (next: string) => any): Editor {
    if (isServer) {
        return {
            select() { },
            selection: () => undefined,
        };
    }

    if (!("EditContext" in window)) {
        throw new Error('`EditContext` is not implemented');
    }

    const [store, setStore] = createStore<EditorStoreType>({
        text: value(),
        isComposing: false,
        selection: undefined,

        // Bounds
        characterBounds: new Array<DOMRect>(),
        controlBounds: new DOMRect(),
        selectionBounds: new DOMRect(),
    });

    const context = new EditContext({
        text: store.text,
    });

    const mutations = observe(ref);
    const ast = createMemo(() => parse(store.text));
    const indexMap = createMap(ref, ast);

    createEffect(() => {
        setValue(store.text);
    });

    // createEffect(() => {
    //     const selection = store.selection;

    //     if (!selection) {
    //         return;
    //     }

    //     console.log(indexMap.query(selection));
    // });

    createEffect(on(() => [ref(), ast()], () => {
        console.log('pre rerender?');
        const selection = store.selection;
        const indices = selection ? indexMap.query(selection) : [];

        queueMicrotask(() => {
            console.log('post rerender?');
            console.log(indices);
        });
    }));

    createEffect(on(value, value => {
        if (value !== store.text) {
            setStore('text', value);
        }
    }));

    createEffect(on(mutations, ([root, mutations]) => {
        const text = (root! as HTMLElement).innerHTML;

        if (text !== store.text) {
            context.updateText(0, context.text.length, text);
            setStore('text', context.text);
        }
    }));

    createEventListenerMap<any>(context, {
        textupdate(e: TextUpdateEvent) {
            const selection = store.selection;

            if (!selection) {
                return;
            }

            selection.extractContents();
            selection.insertNode(document.createTextNode(e.text));
            selection.collapse();
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

    function updateControlBounds() {
        context.updateControlBounds(ref()!.getBoundingClientRect());
    }

    function updateSelection(range: Range) {
        const [start, end] = indexMap.query(range);

        if (!start || !end) {
            return;
        }

        context.updateSelection(start.start + range.startOffset, end.start + range.endOffset);
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
                console.log(e);

                return;
            }

            const start = Math.min(context.selectionStart, context.selectionEnd);
            let end = Math.max(context.selectionStart, context.selectionEnd);

            if (e.key === 'Tab') {
                e.preventDefault();

                context.updateText(start, end, '&nbsp;&nbsp;&nbsp;&nbsp;');
            } else if (e.key === 'Enter') {
                context.updateText(start, end, '</p><p>&nbsp;');
            }
        },
    });

    onMount(() => {
        updateControlBounds();

        // updateSelection(indexMap.fromHtmlIndices(40, 60))
        // updateSelection(indexMap.fromHtmlIndices(599, 603))
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

    return {
        select(range: Range) {
            updateSelection(range);
        },

        selection: createMemo<Range | undefined>(() => {
            return store.selection;
        }),
    };
}

const observe = (node: Accessor<Node | undefined>): Accessor<readonly [Node | undefined, MutationRecord[]]> => {
    const [mutations, setMutations] = createSignal<MutationRecord[]>([]);

    const observer = new MutationObserver(records => {
        setMutations(records);
    });

    createEffect(() => {
        const n = node();

        observer.disconnect();

        if (n) {
            observer.observe(n, { characterData: true, subtree: true, childList: true });
        }
    });

    onCleanup(() => {
        observer.disconnect();
    });

    return createMemo(() => [node(), mutations()] as const);
};

const parseProcessor = unified().use(rehypeParse)
const parse = (text: string) => parseProcessor.parse(text);

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