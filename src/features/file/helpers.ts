import { Accessor, createResource, InitializedResource, onCleanup } from "solid-js";
import { json } from "./parser";
import { filter } from "~/utilities";

interface Files extends Record<string, { handle: FileSystemFileHandle, file: File }> { }

export const load = (file: File): Promise<Map<string, string> | undefined> => {
    switch (file.type) {
        case 'application/json': return json.load(file.stream())

        default: return Promise.resolve(undefined);
    }
};

export const readFiles = (directory: Accessor<FileSystemDirectoryHandle>): InitializedResource<Files> => {
    const [value, { refetch }] = createResource<Files>(async (_, { value: prev }) => {
        prev ??= {};

        const next: Files = Object.fromEntries(await Array.fromAsync(
            filter(directory().values(), (handle): handle is FileSystemFileHandle => handle.kind === 'file' && handle.name.endsWith('.json')),
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
    }, { initialValue: {} })

    const interval = setInterval(() => {
        refetch();
    }, 1000);

    onCleanup(() => {
        clearInterval(interval);
    });

    return value;
};