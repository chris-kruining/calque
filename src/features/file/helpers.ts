import { Accessor, createEffect, createResource, createSignal, InitializedResource, onCleanup, Resource } from "solid-js";
import { json } from "./parser";
import { filter } from "~/utilities";

interface Files extends Record<string, { handle: FileSystemFileHandle, file: File }> { }
interface Contents extends Map<string, Map<string, string>> { }

export const read = (file: File): Promise<Map<string, string> | undefined> => {
    switch (file.type) {
        case 'application/json': return json.load(file.stream());

        default: return Promise.resolve(undefined);
    }
};

export const readFiles = (directory: Accessor<FileSystemDirectoryHandle>): Accessor<Files> => {
    return createPolled<FileSystemDirectoryHandle, Files>(directory, async (directory, prev) => {
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

const LAST_MODIFIED = Symbol('lastModified');
export const contentsOf = (directory: Accessor<FileSystemDirectoryHandle>): Accessor<Contents> => {
    return createPolled<FileSystemDirectoryHandle, Contents>(directory, async (directory, prev) => {
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
    const [tick, update] = createSignal(true);

    const intervalId = setInterval(() => {
        update(v => !v);
    }, interval);

    onCleanup(() => {
        clearInterval(intervalId);
    });

    return tick;
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
        [LAST_MODIFIED]: number;
    }
}