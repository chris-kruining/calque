import { Accessor, Component, createContext, createEffect, createMemo, createSignal, For, JSX, ParentComponent, splitProps, useContext } from "solid-js";
import { CommandType } from "./command";
import css from "./contextMenu.module.css";
import { useCommands } from "./context";

interface ContextMenuType {
    readonly commands: Accessor<CommandType[]>;
    readonly event: Accessor<Event | undefined>;
    show(event: Event): void;
    hide(): void;
}

const ContextMenu = createContext<ContextMenuType>()

const Root: ParentComponent<{ commands: CommandType[] }> = (props) => {
    const [event, setEvent] = createSignal<Event>();

    const context: ContextMenuType = {
        commands: createMemo(() => props.commands),
        event,
        show(event) {
            setEvent(event);
        },
        hide() {
            setEvent(undefined);
        },
    };

    return <ContextMenu.Provider value={context}>
        {props.children}
    </ContextMenu.Provider>
};

const Menu: Component<{ children: (command: CommandType) => JSX.Element }> = (props) => {
    const context = useContext(ContextMenu)!;
    const commandContext = useCommands();
    const [root, setRoot] = createSignal<HTMLElement>();
    const [pos, setPos] = createSignal([0, 0]);

    createEffect(() => {
        const event = context.event();
        const menu = root();

        if (!menu || window.getComputedStyle(menu).display === '') {
            return;
        }

        if (event) {
            menu.showPopover();
        }
        else {
            menu.hidePopover();
        }
    });

    createEffect(() => {
        const { offsetX = 0, offsetY = 0 } = (context.event() ?? {}) as MouseEvent;

        setPos([offsetX, offsetY]);
    });

    const onToggle = (e: ToggleEvent) => {
        if (e.newState === 'closed') {
            context.hide();
        }
    };

    const onCommand = (command: CommandType) => (e: PointerEvent) => {
        commandContext?.execute(command, context.event()!);
        context.hide();
    };

    return <menu ref={setRoot} class={css.menu} anchor={context.event()?.target?.id} style={`translate: ${pos()[0]}px ${pos()[1]}px;`} popover ontoggle={onToggle}>
        <For each={context.commands()}>{
            command => <li onpointerdown={onCommand(command)}>{props.children(command)}</li>
        }</For>
    </menu>;
};

const Handle: ParentComponent<Record<string, any>> = (props) => {
    const [local, rest] = splitProps(props, ['children']);

    const context = useContext(ContextMenu)!;

    return <span {...rest} id={`context-menu-handle-${createUniqueId()};`} oncontextmenu={(e) => {
        e.preventDefault();

        context.show(e);

        return false;
    }}>{local.children}</span>;
};

let handleCounter = 0;
const createUniqueId = () => `${handleCounter++}`;

export const Context = { Root, Menu, Handle };