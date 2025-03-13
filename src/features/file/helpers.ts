import { Accessor, createEffect, from, createSignal } from "solid-js";
import { json } from "./parser";
import { filter } from "~/utilities";
import { isServer } from "solid-js/web";
import { debounce } from "@solid-primitives/scheduled";

interface Files extends Record<string, { handle: FileSystemFileHandle, file: File }> { }
interface Contents extends Map<string, Map<string, string>> { }

export const read = (file: File): Promise<Map<string, string> | undefined> => {
    switch (file.type) {
        case 'application/json': return json.load(file.stream());

        default: return Promise.resolve(undefined);
    }
};

export const readFiles = (directory: Accessor<FileSystemDirectoryHandle | undefined>): Accessor<Files> => {
    return (!isServer && 'FileSystemObserver' in window) ? readFiles__observer(directory) : readFiles__polled(directory)
};

const readFiles__polled = (directory: Accessor<FileSystemDirectoryHandle | undefined>): Accessor<Files> => {
    return createPolled<FileSystemDirectoryHandle | undefined, Files>(directory, async (directory, prev) => {
        if (!directory) {
            return prev;
        }

        const next: Files = Object.fromEntries(await Array.fromAsync(
            filter(directory.values(), (handle): handle is FileSystemFileHandle => handle.kind === 'file' && handle.name.endsWith('.json')),
            async handle => [await handle.getUniqueId(), { file: await handle.getFile(), handle }]
        ));

        const keysPrev = Object.keys(prev);
        const keysNext = Object.keys(next);

        if (keysPrev.length !== keysNext.length) {
            return next;
        }

        if (keysPrev.some(prev => keysNext.includes(prev) === false)) {
            return next;
        }

        if (Object.entries(prev).every(([id, { file }]) => next[id].file.lastModified === file.lastModified) === false) {
            return next;
        }

        return prev;
    }, { interval: 1000, initialValue: {} });
};

const readFiles__observer = (directory: Accessor<FileSystemDirectoryHandle | undefined>): Accessor<Files> => {
    const [files, setFiles] = createSignal<Files>({});

    const observer = new FileSystemObserver(debounce(async records => {
        for (const record of records) {
            switch (record.type) {
                case 'modified': {
                    if (record.changedHandle.kind === 'file') {
                        const handle = record.changedHandle as FileSystemFileHandle;
                        const id = await handle.getUniqueId();
                        const file = await handle.getFile();

                        setFiles(prev => ({ ...prev, [id]: { file, handle } }));
                    }

                    break;
                }

                default: {
                    console.log(record);

                    break;
                }
            }
        }
    }, 10));

    createEffect<FileSystemDirectoryHandle | undefined>((last = undefined) => {
        if (last) {
            observer.unobserve(last);
        }

        const dir = directory();

        if (!dir) {
            return;
        }

        observer.observe(dir);

        (async () => {
            setFiles(Object.fromEntries(
                await dir.values()
                    .filter((handle): handle is FileSystemFileHandle => handle.kind === 'file' && handle.name.endsWith('.json'))
                    .map(async handle => [await handle.getUniqueId(), { file: await handle.getFile(), handle }] as const)
                    .toArray()
            ));
        })();

        return dir;
    });

    return files;
};

const HANDLE = Symbol('handle');
const LAST_MODIFIED = Symbol('lastModified');
export const contentsOf = (directory: Accessor<FileSystemDirectoryHandle | undefined>): Accessor<Contents> => {
    return (!isServer && 'FileSystemObserver' in window) ? contentsOf__observer(directory) : contentsOf__polled(directory)
};

const contentsOf__observer = (directory: Accessor<FileSystemDirectoryHandle | undefined>): Accessor<Contents> => {
    const [contents, setContents] = createSignal<Contents>(new Map);

    const observer = new FileSystemObserver(debounce(async records => {
        for (const record of records) {
            switch (record.type) {
                case 'modified': {
                    if (record.changedHandle.kind === 'file') {
                        const handle = record.changedHandle as FileSystemFileHandle;
                        const id = await handle.getUniqueId();
                        const file = await handle.getFile();
                        const entries = (await read(file))!;
                        entries[LAST_MODIFIED] = file.lastModified;

                        setContents(prev => new Map([...prev, [id, entries]]));
                    }

                    break;
                }

                default: {
                    console.log(record);

                    break;
                }
            }
        }
    }, 10));

    createEffect<FileSystemDirectoryHandle | undefined>((last = undefined) => {
        if (last) {
            observer.unobserve(last);
        }

        const dir = directory();

        if (!dir) {
            return;
        }

        observer.observe(dir);

        (async () => {
            setContents(new Map(await walk(dir).map(async ({ id, file }) => {
                const entries = (await read(file))!;
                entries[LAST_MODIFIED] = file.lastModified;

                return [id, entries] as const;
            }).toArray()));
        })();

        return dir;
    });

    return contents;
};

const contentsOf__polled = (directory: Accessor<FileSystemDirectoryHandle | undefined>): Accessor<Contents> => {
    return createPolled<FileSystemDirectoryHandle | undefined, Contents>(directory, async (directory, prev) => {
        if (!directory) {
            return prev;
        }

        const files = await Array.fromAsync(walk(directory));

        const next = async () => new Map(await Promise.all(files.map(async ({ id, file }) => {
            const entries = (await read(file))!;
            entries[LAST_MODIFIED] = file.lastModified;

            return [id, entries] as const;
        })));

        if (files.length !== prev.size) {
            return next();
        }

        if (files.every(({ id }) => prev.has(id)) === false) {
            return next();
        }

        if (files.every(({ id, file }) => prev.get(id)![LAST_MODIFIED] === file.lastModified) === false) {
            return next();
        }

        return prev;
    }, { interval: 1000, initialValue: new Map() });
};

function createPolled<S, T>(source: Accessor<S>, callback: (source: S, prev: T) => T | Promise<T>, options: { interval: number, initialValue: T }): Accessor<T> {
    const { interval, initialValue } = options;
    const [value, setValue] = createSignal(initialValue);
    const tick = createTicker(interval);

    createEffect(() => {
        tick();
        const s = source();

        (async () => {
            const prev = value();
            const next: T = await callback(s, prev);

            setValue(() => next);
        })();
    });

    return value;
};

function createTicker(interval: number): Accessor<boolean> {
    return from(set => {
        const ref = setInterval(() => set((v = true) => !v), interval);

        return () => clearInterval(ref);
    }) as Accessor<boolean>;
}

async function* walk(directory: FileSystemDirectoryHandle, path: string[] = []): AsyncGenerator<{ id: string, handle: FileSystemFileHandle, path: string[], file: File }, void, never> {
    for await (const handle of directory.values()) {
        if (handle.kind === 'directory') {
            yield* walk(handle, [...path, handle.name]);

            continue;
        }

        if (!handle.name.endsWith('.json')) {
            continue;
        }

        const id = await handle.getUniqueId();
        const file = await handle.getFile();

        yield { id, handle, path, file };
    }
};

declare global {
    interface Map<K, V> {
        [HANDLE]: FileSystemFileHandle;
        [LAST_MODIFIED]: number;
    }

    type FileSystemObserverCallback = (
        records: FileSystemChangeRecord[],
        observer: FileSystemObserver
    ) => void;

    interface FileSystemObserverObserveOptions {
        recursive?: boolean;
    }

    type FileSystemChangeType = 'appeared' | 'disappeared' | 'modified' | 'moved' | 'unknown' | 'errored';

    interface FileSystemChangeRecord {
        readonly changedHandle: FileSystemHandle;
        readonly relativePathComponents: ReadonlyArray<string>;
        readonly type: FileSystemChangeType;
        readonly relativePathMovedFrom?: ReadonlyArray<string>;
    }

    interface FileSystemObserver {
        observe(
            handle: FileSystemHandle,
            options?: FileSystemObserverObserveOptions
        ): Promise<void>;
        unobserve(handle: FileSystemHandle): void;
        disconnect(): void;
    }

    interface FileSystemObserverConstructor {
        new(callback: FileSystemObserverCallback): FileSystemObserver;
        readonly prototype: FileSystemObserver;
    }

    var FileSystemObserver: FileSystemObserverConstructor;
}