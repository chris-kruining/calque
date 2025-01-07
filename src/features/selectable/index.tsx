import { Accessor, children, createContext, createEffect, createMemo, createRenderEffect, createSignal, onCleanup, onMount, ParentComponent, ParentProps, Signal, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";
import css from "./index.module.css";

enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
}

enum SelectionMode {
    Normal,
    Replace,
    Append,
    Toggle,
}

export interface SelectionItem<K, T> {
    key: K;
    value: Accessor<T>;
    element: WeakRef<HTMLElement>;
};

export interface SelectionContextType<K, T extends object> {
    readonly selection: Accessor<SelectionItem<K, T>[]>;
    readonly length: Accessor<number>;
    select(selection: K[], options?: Partial<{ mode: SelectionMode }>): void;
    selectAll(): void;
    clear(): void;
    isSelected(key: K): Accessor<boolean>;
}
interface InternalSelectionContextType<K, T extends object> {
    readonly latest: Signal<HTMLElement | undefined>,
    readonly modifier: Signal<Modifier>,
    readonly selectables: Signal<HTMLElement[]>,
    readonly keyMap: Map<string, K>,
    add(key: K, value: Accessor<T>, element: HTMLElement): string;
}
export interface SelectionHandler<T extends object> {
    (selection: T[]): any;
}

const SelectionContext = createContext<SelectionContextType<any, any>>();
const InternalSelectionContext = createContext<InternalSelectionContextType<any, any>>();

export function useSelection<K, T extends object = object>() {
    const context = useContext(SelectionContext);

    if (context === undefined) {
        throw new Error('selection context is used outside of a provider');
    }

    return context as SelectionContextType<K, T>;
};
function useInternalSelection<K, T extends object>() {
    return useContext(InternalSelectionContext)! as InternalSelectionContextType<K, T>;
}

interface State<K, T extends object> {
    selection: K[];
    data: SelectionItem<K, T>[];
}

export function SelectionProvider<K, T extends object>(props: ParentProps<{ selection?: SelectionHandler<T>, multiSelect?: boolean }>) {
    const [state, setState] = createStore<State<K, T>>({ selection: [], data: [] });
    const selection = createMemo(() => state.data.filter(({ key }) => state.selection.includes(key)));
    const length = createMemo(() => state.data.length);

    createEffect(() => {
        props.selection?.(selection().map(({ value }) => value()));
    });

    const context: SelectionContextType<K, T> = {
        selection,
        length,
        select(selection, { mode = SelectionMode.Normal } = {}) {
            if (props.multiSelect === true && mode === SelectionMode.Normal) {
                mode = SelectionMode.Toggle;
            }

            setState('selection', existing => {
                switch (mode) {
                    case SelectionMode.Toggle: {
                        return [...existing.filter(i => !selection.includes(i)), ...selection.filter(i => !existing.includes(i))];
                    }

                    case SelectionMode.Append: {
                        return existing.concat(selection);
                    }

                    default: {
                        return selection;
                    }
                }
            });
        },
        selectAll() {
            setState('selection', state.data.map(({ key }) => key));
        },
        clear() {
            setState('selection', []);
            internal.modifier[1](Modifier.None);
            internal.latest[1](undefined);
        },
        isSelected(key) {
            return createMemo(() => state.selection.includes(key));
        },
    };

    const keyIdMap = new Map<K, string>();
    const idKeyMap = new Map<string, K>();
    const internal: InternalSelectionContextType<K, T> = {
        modifier: createSignal<Modifier>(Modifier.None),
        latest: createSignal<HTMLElement>(),
        selectables: createSignal<HTMLElement[]>([]),
        keyMap: idKeyMap,
        add(key, value, element) {
            if (keyIdMap.has(key) === false) {
                const id = createUniqueId();

                keyIdMap.set(key, id);
                idKeyMap.set(id, key);

                setState('data', state.data.length, { key, value, element: new WeakRef(element) });
            }

            return keyIdMap.get(key)!;
        },
    };

    return <SelectionContext.Provider value={context}>
        <InternalSelectionContext.Provider value={internal}>
            <Root>{props.children}</Root>
        </InternalSelectionContext.Provider>
    </SelectionContext.Provider>;
};

const Root: ParentComponent = (props) => {
    const internal = useInternalSelection();
    const c = children(() => props.children);

    const [root, setRoot] = createSignal<HTMLElement>();
    const [, setSelectables] = internal.selectables;
    const [, setModifier] = internal.modifier;

    createEffect(() => {
        const r = root();

        if (!isServer && r) {
            const findSelectables = () => {
                setTimeout(() => {
                    setSelectables(Array.from((function* () {
                        const iterator = document.createTreeWalker(r, NodeFilter.SHOW_ELEMENT, {
                            acceptNode: (node: HTMLElement) => node.dataset.selectionKey ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
                        });

                        while (iterator.nextNode()) {
                            yield iterator.currentNode as HTMLElement;
                        }
                    })()));
                }, 100);
            };

            const observer = new MutationObserver(entries => {
                const shouldRecalculate = entries.some(r => r.addedNodes.values().some(node => node instanceof HTMLElement && node.dataset.selectionKey));

                if (shouldRecalculate) {
                    findSelectables();
                }
            });

            findSelectables();

            observer.observe(r, { childList: true, attributes: true, attributeFilter: ['data-selection-key'], subtree: true });
        }
    });

    const onKeyboardEvent = (e: KeyboardEvent) => {
        if (e.repeat || ['Control', 'Shift'].includes(e.key) === false) {
            return;
        }

        setModifier(state => {
            if (e.shiftKey) {
                state |= Modifier.Shift;
            }
            else {
                state &= ~Modifier.Shift;
            }

            if (e.ctrlKey) {
                state |= Modifier.Control;
            }
            else {
                state &= ~Modifier.Control;
            }

            return state;
        });
    };

    return <div ref={setRoot} tabIndex={0} onKeyDown={onKeyboardEvent} onKeyUp={onKeyboardEvent} class={css.root}>{c()}</div>;
};

export function selectable<K, T extends object>(element: HTMLElement, options: Accessor<{ value: T, key: K }>) {
    const context = useSelection<K, T>();
    const internal = useInternalSelection<K, T>();

    const key = options().key;
    const value = createMemo(() => options().value);
    const isSelected = context.isSelected(key);

    const selectionKey = internal.add(key, value, element);

    const createRange = (a?: HTMLElement, b?: HTMLElement): K[] => {
        if (!a && !b) {
            return [];
        }

        if (!a) {
            return [b!.dataset.selectionKey! as K];
        }

        if (!b) {
            return [a!.dataset.selectionKey! as K];
        }

        if (a === b) {
            return [a!.dataset.selectionKey! as K];
        }

        const nodes = internal.selectables[0]();
        const aIndex = nodes.indexOf(a);
        const bIndex = nodes.indexOf(b);
        const selection = nodes.slice(Math.min(aIndex, bIndex), Math.max(aIndex, bIndex) + 1);

        return selection.map(n => internal.keyMap.get(n.dataset.selectionKey!)!);
    };

    createRenderEffect(() => {
        if (isSelected()) {
            element.dataset.selected = 'true';
        } else {
            delete element.dataset.selected;
        }
    });

    const onPointerDown = (e: Event) => {
        const [latest, setLatest] = internal.latest
        const [modifier] = internal.modifier

        const withRange = Boolean(modifier() & Modifier.Shift);
        const append = Boolean(modifier() & Modifier.Control);

        const mode = (() => {
            if (append) return SelectionMode.Toggle;
            if (withRange) return SelectionMode.Replace;
            return SelectionMode.Normal;
        })();

        context.select(withRange ? createRange(latest(), element) : [key], { mode });

        if (!withRange) {
            setLatest(element);
        }
    };

    onMount(() => {
        element.addEventListener('pointerdown', onPointerDown);
    });

    onCleanup(() => {
        if (isServer) {
            return;
        }

        element.removeEventListener('pointerdown', onPointerDown);
    });

    element.classList.add(css.selectable);
    element.dataset.selectionKey = selectionKey;
};

let keyCounter = 0;
const createUniqueId = () => `key-${keyCounter++}`;

declare module "solid-js" {
    namespace JSX {
        interface Directives {
            selectable: { value: object, key: any };
        }
    }
}