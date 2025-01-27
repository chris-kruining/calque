import { Accessor, children, Component, createContext, createEffect, createMemo, createResource, createSignal, For, InitializedResource, JSX, onCleanup, ParentComponent, Setter, Show, useContext } from "solid-js";
import { AiFillFile, AiFillFolder, AiFillFolderOpen } from "solid-icons/ai";
import { SelectionProvider, selectable } from "~/features/selectable";
import { debounce } from "@solid-primitives/scheduled";
import css from "./tree.module.css";

selectable;

export interface FileEntry {
    name: string;
    id: string;
    kind: 'file';
    handle: FileSystemFileHandle;
    directory: FileSystemDirectoryHandle;
    meta: File;
}

export interface FolderEntry {
    name: string; handle
    id: string;
    kind: 'folder';
    handle: FileSystemDirectoryHandle;
    entries: Entry[];
}

export type Entry = FileEntry | FolderEntry;

export const emptyFolder: FolderEntry = { name: '', id: '', kind: 'folder', entries: [], handle: undefined as unknown as FileSystemDirectoryHandle } as const;

export async function* walk(directory: FileSystemDirectoryHandle, filters: RegExp[] = [], depth = 0): AsyncGenerator<Entry, void, never> {
    if (depth === 10) {
        return;
    }

    for await (const handle of directory.values()) {
        if (filters.some(f => f.test(handle.name))) {
            continue;
        }

        const id = await handle.getUniqueId();

        if (handle.kind === 'file') {
            yield { name: handle.name, id, handle, kind: 'file', meta: await handle.getFile(), directory };
        }
        else {
            yield { name: handle.name, id, handle, kind: 'folder', entries: await Array.fromAsync(walk(handle, filters, depth + 1)) };
        }
    }
}

interface TreeContextType {
    readonly tree: Accessor<FolderEntry>;
    readonly name: Accessor<string>;
    readonly open: Accessor<boolean>;
    readonly setOpen: Setter<boolean>;

    onOpen(file: File): void;
}

const TreeContext = createContext<TreeContextType>();

export const TreeProvider: ParentComponent<{ directory: FileSystemDirectoryHandle, onOpen?: (file: File) => void }> = (props) => {
    const [open, setOpen] = createSignal(false);
    const tree = readTree(() => props.directory);

    const context = {
        tree,
        name: createMemo(() => props.directory.name),
        open,
        setOpen,

        onOpen(file: File) {
            props.onOpen?.(file);
        },
    };

    return <TreeContext.Provider value={context}>
        {props.children}
    </TreeContext.Provider>;
}

export const useTree = () => {
    const context = useContext(TreeContext);

    if (!context) {
        throw new Error('`useTree` is called outside of a <TreeProvider />');
    }

    return context;
}

export const Tree: Component<{
    children: readonly [(folder: Accessor<FolderEntry>) => JSX.Element, (file: Accessor<FileEntry>) => JSX.Element]
}> = (props) => {
    const [, setSelection] = createSignal<object[]>([]);
    const context = useTree();

    return <SelectionProvider selection={setSelection}>
        <div class={css.root}><_Tree entries={context.tree().entries} children={props.children} /></div>
    </SelectionProvider>;
}

const _Tree: Component<{ entries: Entry[], children: readonly [(folder: Accessor<FolderEntry>) => JSX.Element, (file: Accessor<FileEntry>) => JSX.Element] }> = (props) => {
    const context = useTree();

    return <For each={props.entries.toSorted(sort_by('kind'))}>{
        entry => <>
            <Show when={entry.kind === 'folder' ? entry : undefined}>{
                folder => <Folder folder={folder()} children={props.children} />
            }</Show>

            <Show when={entry.kind === 'file' ? entry : undefined}>{
                file => <span use:selectable={{ key: file().id, value: file() }} ondblclick={() => context.onOpen(file().meta)}><AiFillFile /> {props.children[1](file)}</span>
            }</Show>
        </>
    }</For>
}

const Folder: Component<{ folder: FolderEntry, children: readonly [(folder: Accessor<FolderEntry>) => JSX.Element, (file: Accessor<FileEntry>) => JSX.Element] }> = (props) => {
    const [open, setOpen] = createSignal(true);

    return <details open={open()} ontoggle={() => debounce(() => setOpen(o => !o), 1)}>
        <summary><Show when={open()} fallback={<AiFillFolder />}><AiFillFolderOpen /></Show> {props.children[0](() => props.folder)}</summary>
        <_Tree entries={props.folder.entries} children={props.children} />
    </details>;
};

const sort_by = (key: string) => (objA: Record<string, any>, objB: Record<string, any>) => {
    const a = objA[key];
    const b = objB[key];

    return Number(a < b) - Number(b < a);
};

const readTree = (directory: Accessor<FileSystemDirectoryHandle>): Accessor<FolderEntry> => {
    const [entries, { refetch }] = createResource<Entry[]>(async (_, { value: prev }) => {
        const dir = directory();

        prev ??= [];
        const next: Entry[] = await Array.fromAsync(walk(dir));

        const prevEntries = flatten(prev).map(e => e.id).toSorted();
        const nextEntries = flatten(next).map(e => e.id).toSorted();

        if (prevEntries.length !== nextEntries.length) {
            return next;
        }

        if (prevEntries.some((entry, i) => entry !== nextEntries[i])) {
            return next;
        }

        return prev;
    }, { initialValue: [] })

    const interval = setInterval(() => {
        refetch();
    }, 1000);

    onCleanup(() => {
        clearInterval(interval);
    });

    createEffect(() => {
        console.log(entries.latest);
    });

    return createMemo<FolderEntry>(() => ({ name: directory().name, id: '', kind: 'folder', handle: directory(), entries: entries.latest }));
};

const flatten = (entries: Entry[]): Entry[] => {
    return entries.flatMap(entry => entry.kind === 'folder' ? [entry, ...flatten(entry.entries)] : entry)
}