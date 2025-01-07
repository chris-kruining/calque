import { Accessor, children, createContext, createEffect, createMemo, createSignal, For, ParentComponent, Setter, Show, useContext } from "solid-js";
import { Command, CommandType, noop, useCommands } from "~/features/command";
import { AiOutlineClose } from "solid-icons/ai";
import css from "./tabs.module.css";

type CloseTabCommandType = CommandType<(id: string) => any>;
interface TabsContextType {
    activate(id: string | undefined): void;
    isActive(id: string): Accessor<boolean>;
    readonly onClose: Accessor<CloseTabCommandType | undefined>
}

const TabsContext = createContext<TabsContextType>();

const useTabs = () => {
    const context = useContext(TabsContext);

    if (context === undefined) {
        throw new Error('<Tab /> is used outside of a <Tabs />')
    }

    return context!;
}

export const Tabs: ParentComponent<{ class?: string, active?: string, setActive?: Setter<string | undefined>, onClose?: CloseTabCommandType }> = (props) => {
    const [active, setActive] = createSignal<string | undefined>(props.active);

    createEffect(() => {
        props.setActive?.(active());
    });

    const ctx = {
        activate(id: string) {
            setActive(id);
        },

        isActive(id: string) {
            return createMemo(() => active() === id);
        },

        onClose: createMemo(() => props.onClose),
    };

    return <TabsContext.Provider value={ctx}>
        <_Tabs class={props.class} active={active()} onClose={props.onClose}>{props.children}</_Tabs>
    </TabsContext.Provider >;
}

const _Tabs: ParentComponent<{ class?: string, active: string | undefined, onClose?: CloseTabCommandType }> = (props) => {
    const commandsContext = useCommands();
    const tabsContext = useTabs();

    const resolved = children(() => props.children);
    const tabs = createMemo(() => resolved.toArray().filter(c => c instanceof HTMLElement).map(({ id, dataset }, i) => ({ id, label: dataset.tabLabel ?? '', options: { closable: Boolean(dataset.tabClosable ?? 'false') } })));

    const onClose = (e: Event) => {
        if (!commandsContext || !props.onClose) {
            return;
        }

        return commandsContext.execute(props.onClose, e);
    };

    return <div class={`${css.tabs} ${props.class}`}>
        <header>
            <For each={tabs()}>{
                ({ id, label, options: { closable } }) => <Command.Context for={props.onClose!} with={[id]}>
                    <span class={css.handle} classList={{ [css.active]: props.active === id }}>
                        <button onpointerdown={(e) => {
                            if (closable && e.pointerType === 'mouse' && e.button === 1) {
                                onClose(e);

                                return;
                            }

                            tabsContext.activate(id)
                        }}>{label}</button>

                        <Show when={closable}>
                            <button onPointerDown={onClose}> <AiOutlineClose /></button>
                        </Show>
                    </span>
                </Command.Context>
            }</For>
        </header>

        {resolved()}
    </div>;
};

export const Tab: ParentComponent<{ id: string, label: string, closable?: boolean }> = (props) => {
    const context = useTabs();
    const resolved = children(() => props.children);
    const isActive = context.isActive(props.id);

    return <div
        id={props.id}
        class={css.tab}
        data-tab-label={props.label}
        data-tab-closable={props.closable}
    >
        <Show when={isActive()}>
            <Command.Context for={context.onClose() ?? noop} with={[props.id]}>{resolved()}</Command.Context>
        </Show>
    </div>;
}