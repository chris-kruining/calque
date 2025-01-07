import { DictionaryKey } from "../i18n";

export enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
    Meta = 1 << 2,
    Alt = 1 << 3,
}

export interface CommandType<T extends (...args: any[]) => any = (...args: any[]) => any> {
    (...args: Parameters<T>): Promise<ReturnType<T>>;
    label: DictionaryKey;
    shortcut?: {
        key: string;
        modifier: Modifier;
    };
    withLabel(label: string): CommandType<T>;
    with<A extends any[], B extends any[]>(this: (this: ThisParameterType<T>, ...args: [...A, ...B]) => ReturnType<T>, ...args: A): CommandType<(...args: B) => ReturnType<T>>;
}

export const createCommand = <T extends (...args: any[]) => any>(label: DictionaryKey, command: T, shortcut?: CommandType['shortcut']): CommandType<T> => {
    return Object.defineProperties(((...args: Parameters<T>) => command(...args)) as any, {
        label: {
            value: label,
            configurable: false,
            writable: false,
        },
        shortcut: {
            value: shortcut ? { key: shortcut.key.toLowerCase(), modifier: shortcut.modifier } : undefined,
            configurable: false,
            writable: false,
        },
        withLabel: {
            value(label: DictionaryKey) {
                return createCommand(label, command, shortcut);
            },
            configurable: false,
            writable: false,
        },
        with: {
            value<A extends any[], B extends any[]>(this: (this: ThisParameterType<T>, ...args: [...A, ...B]) => ReturnType<T>, ...args: A): CommandType<(...args: B) => ReturnType<T>> {
                return createCommand(label, command.bind(undefined, ...args), shortcut);
            },
            configurable: false,
            writable: false,
        }
    });
};

export const noop = createCommand('noop' as any, () => { }); 