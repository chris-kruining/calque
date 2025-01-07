import { Accessor, Component, For, JSX, Match, ParentComponent, Setter, Show, Switch, children, createContext, createEffect, createMemo, createSignal, mergeProps, useContext } from "solid-js";
import { Portal } from "solid-js/web";
import { createStore } from "solid-js/store";
import { CommandType, Command, useCommands } from "../command";
import css from "./index.module.css";
import { Dropdown, DropdownApi } from "~/components/dropdown";

export interface MenuContextType {
    ref: Accessor<Node | undefined>;
    setRef: Setter<Node | undefined>;

    addItems(items: (Item | Separator | ItemWithChildren)[]): void;
    items: Accessor<(Item | Separator | ItemWithChildren)[]>;
    commands(): CommandType[];
};

export interface Item {
    kind: 'leaf';
    id: string;
    label: string;
    command: CommandType;
}

export interface Separator {
    kind: 'separator';
}

export interface ItemWithChildren {
    kind: 'node';
    id: string;
    label: string;
    children: (Item | Separator)[];
}

const MenuContext = createContext<MenuContextType>();

export const MenuProvider: ParentComponent<{ commands?: CommandType[] }> = (props) => {
    const [ref, setRef] = createSignal<Node | undefined>();
    const [store, setStore] = createStore<{ items: Map<string, Item | ItemWithChildren> }>({ items: new Map });

    const ctx = {
        ref,
        setRef,
        addItems(items: (Item | ItemWithChildren)[]) {
            return setStore('items', values => {
                for (const item of items) {
                    values.set(item.id, item);
                }

                return new Map(values.entries());
            })
        },
        items() {
            return store.items.values();
        },
        commands() {
            return store.items.values()
                .flatMap(item => item.kind === 'node' ? item.children.filter(c => c.kind === 'leaf').map(c => c.command) : [item.command])
                .toArray()
                .concat(props.commands ?? []);
        },
    };

    return <Command.Root commands={ctx.commands()}>
        <MenuContext.Provider value={ctx}>{props.children}</MenuContext.Provider>
    </Command.Root>;
}

const useMenu = () => {
    const context = useContext(MenuContext);

    if (context === undefined) {
        throw new Error(`MenuContext is called outside of a <MenuProvider />`);
    }

    return context;
}

type ItemProps<T extends (...args: any[]) => any> = { label: string, children: JSX.Element, command?: undefined } | { command: CommandType<T> };

function Item<T extends (...args: any[]) => any>(props: ItemProps<T>) {
    const id = createUniqueId();

    if (props.command) {
        return mergeProps(props, { id, kind: 'leaf' }) as unknown as JSX.Element;
    }

    const childItems = children(() => props.children);

    return mergeProps(props, {
        id,
        kind: 'node',
        get children() {
            return childItems.toArray();
        }
    }) as unknown as JSX.Element;
}

const Separator: Component = (props) => {
    return mergeProps(props, { kind: 'separator' }) as unknown as JSX.Element;
}

const Root: ParentComponent<{}> = (props) => {
    const menuContext = useMenu();
    const commandContext = useCommands();
    const items = children(() => props.children).toArray() as unknown as (Item | ItemWithChildren)[];

    menuContext.addItems(items);

    return <Portal mount={menuContext.ref()}>
        <For each={items}>{
            item => <Switch>
                <Match when={item.kind === 'node' ? item as ItemWithChildren : undefined}>{
                    item => {
                        const [dropdown, setDropdown] = createSignal<DropdownApi>();

                        return <Dropdown api={setDropdown} class={css.child} id={`child-${item().id}`} text={item().label}>
                            <For each={item().children}>{
                                child => <Switch>
                                    <Match when={child.kind === 'leaf' ? child as Item : undefined}>{
                                        item => <button class={css.item} type="button" onpointerdown={e => {
                                            commandContext?.execute(item().command, e);
                                            dropdown()?.hide();
                                        }}>
                                            <Command.Handle command={item().command} />
                                        </button>
                                    }</Match>

                                    <Match when={child.kind === 'separator'}><hr class={css.separator} /></Match>
                                </Switch>}</For>
                        </Dropdown>;
                    }
                }</Match>

                <Match when={item.kind === 'leaf' ? item as Item : undefined}>{
                    item => <button class={css.item} type="button" onpointerdown={e => commandContext?.execute(item().command, e)}>
                        <Command.Handle command={item().command} />
                    </button>
                }</Match>
            </Switch>
        }</For>
    </Portal>
};

const Mount: Component = (props) => {
    const menu = useMenu();

    return <menu class={css.root} ref={menu.setRef} />;
};

export const Menu = { Mount, Root, Item, Separator } as const;

let keyCounter = 0;
const createUniqueId = () => `key-${keyCounter++}`;

declare module "solid-js" {
    namespace JSX {
        interface HTMLAttributes<T> {
            anchor?: string | undefined;
        }
    }
}
