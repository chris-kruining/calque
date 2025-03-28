import { Accessor, children, Component, createContext, createEffect, createMemo, For, JSX, Match, ParentComponent, ParentProps, Show, Switch, useContext } from 'solid-js';
import { useI18n } from '../i18n';
import { createStore } from 'solid-js/store';
import { CommandType, Modifier } from './command';
import { BsCommand, BsOption, BsShift, BsWindows } from 'solid-icons/bs';

interface CommandContextType {
    readonly commands: Accessor<CommandType[]>;
    set(commands: CommandType<any>[]): void;
    addContextualArguments<T extends (...args: any[]) => any = any>(command: CommandType<T>, target: EventTarget, args: Accessor<Parameters<T>>): void;
    execute<T extends (...args: any[]) => any = any>(command: CommandType<T>, event: Event): void;
}

interface CommandContextStateType {
    commands: CommandType[];
    contextualArguments: Map<CommandType, WeakMap<EventTarget, Accessor<any[]>>>;
}

const CommandContext = createContext<CommandContextType>();

export const useCommands = () => useContext(CommandContext);

const Root: ParentComponent<{ commands: CommandType[] }> = (props) => {
    const [store, setStore] = createStore<CommandContextStateType>({ commands: [], contextualArguments: new Map() });

    const context = {
        commands: createMemo(() => store.commands),

        set(commands: CommandType<any>[]): void {
            setStore('commands', existing => new Set([...existing, ...commands]).values().toArray());
        },

        addContextualArguments<T extends (...args: any[]) => any = any>(command: CommandType<T>, target: EventTarget, args: Accessor<Parameters<T>>): void {
            setStore('contextualArguments', prev => {
                if (prev.has(command) === false) {
                    prev.set(command, new WeakMap());
                }

                prev.get(command)?.set(target, args);

                return new Map(prev);
            })
        },

        execute<T extends (...args: any[]) => any = any>(command: CommandType<T>, event: Event): boolean | undefined {
            const args = ((): Parameters<T> => {
                const contexts = store.contextualArguments.get(command);

                if (contexts === undefined) {
                    return [] as any;
                }

                const element = event.composedPath().find(el => contexts.has(el));

                if (element === undefined) {
                    return [] as any;
                }

                const args = contexts.get(element)! as Accessor<Parameters<T>>;

                return args();
            })();

            event.preventDefault();
            event.stopPropagation();

            command(...args);

            return false;
        },
    };

    createEffect(() => {
        context.set(props.commands ?? []);
    });

    const listener = (e: KeyboardEvent) => {
        if (!e.key) {
            return;
        }

        const key = e.key.toLowerCase();
        const modifiers =
            (e.shiftKey ? 1 : 0) << 0 |
            (e.ctrlKey ? 1 : 0) << 1 |
            (e.metaKey ? 1 : 0) << 2 |
            (e.altKey ? 1 : 0) << 3;

        const command = store.commands.values().find(c => c.shortcut?.key === key && (c.shortcut.modifier === undefined || c.shortcut.modifier === modifiers));

        if (command === undefined) {
            return;
        }

        return context.execute(command, e);
    };

    return <CommandContext.Provider value={context}>
        <div tabIndex={0} style="display: contents;" onKeyDown={listener}>{props.children}</div>
    </CommandContext.Provider>;
};

const Add: Component<{ command: CommandType, commands: undefined } | { commands: CommandType[] }> = (props) => {
    const context = useCommands();
    const commands = createMemo<CommandType[]>(() => props.commands ?? [props.command]);

    createEffect(() => {
        context?.set(commands());
    });

    return undefined;
};

const Context = <T extends (...args: any[]) => any = (...args: any[]) => any>(props: ParentProps<{ for: CommandType<T>, with: Parameters<T> }>): JSX.Element => {
    const resolved = children(() => props.children);
    const context = useCommands();
    const args = createMemo(() => props.with);

    createEffect(() => {
        const children = resolved();

        if (Array.isArray(children) || !(children instanceof Element)) {
            return;
        }

        context?.addContextualArguments(props.for, children, args);
    });

    return <>{resolved()}</>;
};

const Handle: Component<{ command: CommandType }> = (props) => {
    const { t } = useI18n();

    const isMac = false;
    const isWindows = false;

    return <>
        {String(t(props.command.label) ?? props.command.label)}

        <Show when={props.command.shortcut}>{
            shortcut => {
                const modifier = shortcut().modifier;

                const title: Record<number, string> = {
                    [Modifier.Shift]: 'shift',
                    [Modifier.Control]: 'control',
                    [Modifier.Meta]: 'meta',
                    [Modifier.Alt]: 'alt',
                };

                return <samp>
                    <For each={Object.values(Modifier).filter((m): m is number => typeof m === 'number').filter(m => modifier & m)}>{
                        (m) => <><kbd title={title[m]}>
                            <Switch>
                                <Match when={m === Modifier.Shift}>
                                    <BsShift />
                                </Match>

                                <Match when={m === Modifier.Control}>
                                    <Show when={isMac} fallback="Ctrl"><BsCommand /></Show>
                                </Match>

                                <Match when={m === Modifier.Meta}>
                                    <Show when={isWindows} fallback="Meta"><BsWindows /></Show>
                                </Match>

                                <Match when={m === Modifier.Alt}>
                                    <Show when={isMac} fallback="Alt"><BsOption /></Show>
                                </Match>
                            </Switch>
                        </kbd>+</>
                    }</For>
                    <kbd>{shortcut().key.toUpperCase()}</kbd>
                </samp>;
            }
        }</Show>
    </>;
};

export const Command = { Root, Handle, Add, Context };