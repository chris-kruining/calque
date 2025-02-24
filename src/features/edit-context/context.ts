import { createEventListenerMap, DocumentEventListener, WindowEventListener } from "@solid-primitives/event-listener";
import { Accessor, createEffect, createMemo, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";
import { createSelection, getTextNodes } from "@solid-primitives/selection";
import { visit } from "unist-util-visit";
import type { Root, Text } from 'hast';
import { unified } from "unified";
import rehypeParse from "rehype-parse";

type EditContext = [Accessor<string>];

export function createEditContext(ref: Accessor<HTMLElement | undefined>, value: Accessor<string>): EditContext {
    if (isServer) {
        return [createMemo(() => value())];
    }

    if (!("EditContext" in window)) {
        throw new Error('`EditContext` is not implemented');
    }

    const context = new EditContext({
        text: value(),
    });

    const [store, setStore] = createStore({
        text: value(),
        isComposing: false,

        // Bounds
        characterBounds: new Array<DOMRect>(),
        controlBounds: new DOMRect(),
        selectionBounds: new DOMRect(),
    });

    const ast = createMemo(() => unified().use(rehypeParse).parse(store.text));
    const indices = createMemo(() => {
        const root = ref();

        if (!root) {
            return [];
        }

        const nodes = getTextNodes(root);
        const indices: { node: Node, text: { start: number, end: number }, html: { start: number, end: number } }[] = [];

        let index = 0;
        visit(ast(), n => n.type === 'text', (node) => {
            const { position, value } = node as Text;
            const end = index + value.length;

            if (position) {
                indices.push({ node: nodes.shift()!, text: { start: index, end }, html: { start: position.start.offset!, end: position.end.offset! } });
            }

            index = end;
        });

        return indices;
    });
    const [selection, setSelection] = createSelection();

    createEffect(() => {
        console.log(indices());
    });

    createEventListenerMap<any>(context, {
        textupdate(e: TextUpdateEvent) {
            const { updateRangeStart: start, updateRangeEnd: end } = e;

            setStore('text', `${store.text.slice(0, start)}${e.text}${store.text.slice(end)}`);

            updateSelection(toRange(ref()!, start, end));

            setTimeout(() => {
                console.log('hmmm', e, start, end);
                context.updateSelection(start, end);


                setSelection([ref()!, start, end]);
            }, 1000);
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
        const [start, end] = toIndices(ref()!, range);

        let index = 0;
        let mappedStart = -1;
        let mappedEnd = -1;

        visit(ast(), n => n.type === 'text', (node) => {
            const { position, value } = node as Text;

            if (position) {
                if (index <= start && (index + value.length) >= start) {
                    mappedStart = position.start.offset! + range.startOffset;
                }

                if (index <= end && (index + value.length) >= end) {
                    mappedEnd = position.start.offset! + range.endOffset;
                }
            }

            index += value.length;
        });

        context.updateSelection(mappedStart, mappedEnd);
        context.updateSelectionBounds(range.getBoundingClientRect());

        setSelection([ref()!, start, end]);
    }

    WindowEventListener({
        onresize() {
            updateControlBounds()
        },
    });

    createEventListenerMap(() => ref()!, {
        keydown(e: KeyboardEvent) {
            // keyCode === 229 is a special code that indicates an IME event.
            // https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime
            if (e.keyCode === 229) {
                return;
            }

            const start = context.selectionStart;
            const end = context.selectionEnd;

            if (e.key === 'Tab') {
                e.preventDefault();

                context.updateText(start, end, '\t');
                // updateSelection(start + 1, start + 1);
            } else if (e.key === 'Enter') {
                context.updateText(start, end, '\n');

                // updateSelection(start + 1, start + 1);
            }
        },
    });

    DocumentEventListener({
        onSelectionchange(e) {
            const selection = document.getSelection()!;

            if (selection.rangeCount < 1) {
                return;
            }

            if (document.activeElement !== ref()) {
                return;
            }

            updateSelection(selection.getRangeAt(0)!);
        },
    });

    onMount(() => {
        updateControlBounds();
    });

    createEffect((last?: HTMLElement) => {
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
        context.updateText(0, 0, value());
    });

    return [createMemo(() => store.text)];
}

declare global {
    interface HTMLElement {
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
        new(options: Partial<{ text: string, selectionStart: number, selectionEnd: number }>): EditContext;
        readonly prototype: EditContext;
    }

    var EditContext: EditContextConstructor;
}

const offsetOf = (node: Node, nodes: Node[]) => nodes.slice(0, nodes.indexOf(node)).reduce((t, n) => t + n.textContent!.length, 0);

const toRange = (root: Node, start: number, end: number): Range => {
    let index = 0;
    let startNode = null;
    let endNode = null;

    for (const node of getTextNodes(root)) {
        const length = node.textContent!.length;

        if (index <= start && (index + length) >= start) {
            startNode = [node, Math.abs(end - index)] as const;
        }

        if (index <= end && (index + length) >= end) {
            endNode = [node, Math.abs(end - index)] as const;
        }

        if (startNode !== null && endNode !== null) {
            break;
        }

        index += length;
    }

    const range = new Range();

    if (startNode !== null) {
        range.setStart(...startNode);
    }

    if (endNode !== null) {
        range.setEnd(...endNode);
    }

    return range;
};

const toIndices = (node: Node, range: Range): [number, number] => {
    const nodes = getTextNodes(node);
    const start = offsetOf(range.startContainer, nodes) + range.startOffset;
    const end = offsetOf(range.endContainer, nodes) + range.endOffset;

    return [start, end];
};