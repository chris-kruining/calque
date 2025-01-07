import { Component, createEffect, createMemo, createSignal, For, onMount, ParentProps, Setter, Show } from "solid-js";
import { Created, filter, MutarionKind, Mutation, splitAt } from "~/utilities";
import { Sidebar } from "~/components/sidebar";
import { emptyFolder, FolderEntry, walk as fileTreeWalk, Tree } from "~/components/filetree";
import { Menu } from "~/features/menu";
import { Grid, load, useFiles } from "~/features/file";
import { Command, CommandType, Context, createCommand, Modifier } from "~/features/command";
import { Entry, GridApi } from "~/features/file/grid";
import { Tab, Tabs } from "~/components/tabs";
import { isServer } from "solid-js/web";
import { Prompt, PromptApi } from "~/components/prompt";
import EditBlankImage from '~/assets/edit-blank.svg'
import { useI18n } from "~/features/i18n";
import { makePersisted } from "@solid-primitives/storage";
import css from "./edit.module.css";

const isInstalledPWA = !isServer && window.matchMedia('(display-mode: standalone)').matches;

async function* walk(directory: FileSystemDirectoryHandle, path: string[] = []): AsyncGenerator<{ id: string, handle: FileSystemFileHandle, path: string[], lang: string, entries: Map<string, string> }, void, never> {
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
        const lang = file.name.split('.').at(0)!;
        const entries = await load(file);

        if (entries !== undefined) {
            yield { id, handle, path, lang, entries };
        }
    }
};


// interface Entries extends Map<string, Record<string, { value: string, handle: FileSystemFileHandle, id: string }>> { };
interface Entries extends Map<string, { key: string, } & Record<string, { value: string, handle: FileSystemFileHandle, id: string }>> { };

export default function Edit(props: ParentProps) {
    const filesContext = useFiles();

    onMount(() => {
        if (!('showDirectoryPicker' in window)) {
            throw new Error('Unable to manage files', {
                cause: {
                    description: <p>
                        The browser you are using does not support the File Access API.<br />
                        This API is crutial for this app.
                    </p>
                }
            });
        }
    });

    const open = createCommand('page.edit.command.open', async () => {
        const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

        filesContext.open(directory);
    }, { key: 'o', modifier: Modifier.Control });

    return <Context.Root commands={[open]}>
        <Show when={filesContext.root()} fallback={<Blank open={open} />}>{
            root => <Editor root={root()} />
        }</Show>
    </Context.Root>;
}

const Editor: Component<{ root: FileSystemDirectoryHandle }> = (props) => {
    const filesContext = useFiles();
    const { t } = useI18n();

    const tabs = createMemo(() => filesContext.files().map(({ key, handle }) => {
        const [api, setApi] = createSignal<(GridApi & { addLocale(locale: string): void })>();
        const [entries, setEntries] = createSignal<Entries>(new Map());
        const [files, setFiles] = createSignal<Map<string, { id: string, handle: FileSystemFileHandle }>>(new Map());

        (async () => {
            const files = await Array.fromAsync(
                filter(handle.values(), entry => entry.kind === 'file'),
                async file => [file.name.split('.').at(0)!, { handle: file, id: await file.getUniqueId() }] as const
            );

            setFiles(new Map(files));
        })();

        return ({ key, handle, api, setApi, entries, setEntries, files });
    }));
    const [active, setActive] = makePersisted(createSignal<string>(), { name: 'edit__aciveTab' });
    const [contents, setContents] = createSignal<Map<string, Map<string, string>>>(new Map());
    const [tree, setFiles] = createSignal<FolderEntry>(emptyFolder);
    const [newKeyPrompt, setNewKeyPrompt] = createSignal<PromptApi>();
    const [newLanguagePrompt, setNewLanguagePrompt] = createSignal<PromptApi>();

    const tab = createMemo(() => {
        const name = active();

        return tabs().find(t => t.handle.name === name);
    });
    const api = createMemo(() => tab()?.api());
    const mutations = createMemo<(Mutation & { lang: string, file?: { value: string, handle: FileSystemFileHandle, id: string } })[]>(() => tabs().flatMap(tab => {
        const entries = tab.entries();
        const files = tab.files();
        const mutations = tab.api()?.mutations() ?? [];

        return mutations.flatMap((m): any => {
            const [index, lang] = splitAt(m.key, m.key.indexOf('.'));

            switch (m.kind) {
                case MutarionKind.Update: {
                    const entry = entries.get(index as any)!;
                    return { kind: MutarionKind.Update, key: entry.key, lang, file: files.get(lang)!, value: m.value };
                }

                case MutarionKind.Create: {
                    if (typeof m.value === 'object') {
                        const { key, ...locales } = m.value;
                        return Object.entries(locales).map(([lang, value]) => ({ kind: MutarionKind.Create, key, lang, file: files.get(lang)!, value }));
                    }

                    const entry = entries.get(index as any)!;
                    return { kind: MutarionKind.Create, key: entry.key, lang, file: undefined, value: m.value };
                }

                case MutarionKind.Delete: {
                    const entry = entries.get(index as any)!;
                    return files.values().map(file => ({ kind: MutarionKind.Delete, key: entry.key, file })).toArray();
                }

                default: throw new Error('unreachable code');
            }
        });
    }));
    const mutatedFiles = createMemo(() =>
        new Set((mutations()).map(({ file }) => file).filter(file => file !== undefined))
    );
    const mutatedData = createMemo(() => {
        const muts = mutations();
        const files = contents();
        const entries = mutatedFiles().values();

        if (muts.length === 0) {
            return [];
        }

        const groupedByFileId = Object.groupBy(muts, m => m.file?.id ?? 'undefined');
        const newFiles = Object.entries(Object.groupBy((groupedByFileId['undefined'] ?? []) as (Created & { lang: string, file: undefined })[], m => m.lang)).map(([lang, mutations]) => {
            const data = mutations!.reduce((aggregate, { key, value }) => {
                let obj = aggregate;
                const i = key.lastIndexOf('.');

                if (i !== -1) {
                    const [k, lastPart] = splitAt(key, i);

                    for (const part of k.split('.')) {
                        if (!Object.hasOwn(obj, part)) {
                            obj[part] = {};
                        }

                        obj = obj[part];
                    }

                    obj[lastPart] = value;
                }
                else {
                    obj[key] = value;
                }

                return aggregate;
            }, {} as Record<string, any>);

            return [{ existing: false, name: lang }, data] as const;
        })

        const existingFiles = entries.map(({ id, handle }) => {
            const existing = new Map(files.get(id)!);
            const mutations = groupedByFileId[id]!;

            for (const mutation of mutations) {
                switch (mutation.kind) {
                    case MutarionKind.Delete: {
                        existing.delete(mutation.key);
                        break;
                    }

                    case MutarionKind.Update:
                    case MutarionKind.Create: {
                        existing.set(mutation.key, mutation.value);
                        break;
                    }
                }
            }

            return [
                { existing: true, handle },
                existing.entries().reduce((aggregate, [key, value]) => {
                    let obj = aggregate;
                    const i = key.lastIndexOf('.');

                    if (i !== -1) {
                        const [k, lastPart] = splitAt(key, i);

                        for (const part of k.split('.')) {
                            if (!Object.hasOwn(obj, part)) {
                                obj[part] = {};
                            }

                            obj = obj[part];
                        }

                        obj[lastPart] = value;
                    }
                    else {
                        obj[key] = value;
                    }

                    return aggregate;
                }, {} as Record<string, any>)
            ] as const;
        }).toArray() as (readonly [({ existing: true, handle: FileSystemFileHandle } | { existing: false, name: string }), Record<string, any>])[];

        return existingFiles.concat(newFiles);
    });

    createEffect(() => {
        const directory = props.root;

        (async () => {
            setContents(new Map(await Array.fromAsync(walk(directory), ({ id, entries }) => [id, entries] as const)))
            setFiles({ name: directory.name, id: '', kind: 'folder', handle: directory, entries: await Array.fromAsync(fileTreeWalk(directory)) });
        })();
    });

    const commands = {
        open: createCommand('page.edit.command.open', async () => {
            const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

            await filesContext.open(directory);
        }, { key: 'o', modifier: Modifier.Control }),
        close: createCommand('page.edit.command.close', async () => {
            await filesContext.close();
        }),
        closeTab: createCommand('page.edit.command.closeTab', async (id: string) => {
            filesContext.remove(id);
        }, { key: 'w', modifier: Modifier.Control | (isInstalledPWA ? Modifier.None : Modifier.Alt) }),
        save: createCommand('page.edit.command.save', async () => {
            await Promise.allSettled(mutatedData().map(async ([file, data]) => {
                // TODO :: add the newly created file to the known files list to that the save file picker is not shown again on subsequent saves
                const handle = file.existing ? file.handle : await window.showSaveFilePicker({ suggestedName: file.name, excludeAcceptAllOption: true, types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }] });

                const stream = await handle.createWritable({ keepExistingData: false });

                stream.write(JSON.stringify(data, null, 4));
                stream.write('\n');
                stream.close();
            }));
        }, { key: 's', modifier: Modifier.Control }),
        saveAs: createCommand('page.edit.command.saveAs', (handle?: FileSystemFileHandle) => {
            console.log('save as ...', handle);

            window.showSaveFilePicker({
                startIn: props.root,
                excludeAcceptAllOption: true,
                types: [
                    { accept: { 'application/json': ['.json'] }, description: 'JSON' },
                    { accept: { 'application/yaml': ['.yml', '.yaml'] }, description: 'YAML' },
                    { accept: { 'application/csv': ['.csv'] }, description: 'CSV' },
                ]
            });

        }, { key: 's', modifier: Modifier.Control | Modifier.Shift }),
        selectAll: createCommand('page.edit.command.selectAll', () => {
            api()?.selectAll();
        }, { key: 'a', modifier: Modifier.Control }),
        clearSelection: createCommand('page.edit.command.clearSelection', () => {
            api()?.clearSelection();
        }),
        delete: createCommand('page.edit.command.delete', () => {
            const { selection, remove } = api() ?? {};

            if (!selection || !remove) {
                return;
            }

            remove(selection().map(s => s.key));
        }, { key: 'delete', modifier: Modifier.None }),
        insertKey: createCommand('page.edit.command.insertKey', async () => {
            const formData = await newKeyPrompt()?.showModal();
            const key = formData?.get('key')?.toString();

            if (!key) {
                return;
            }

            api()?.addKey(key);
        }),
        insertLanguage: createCommand('page.edit.command.insertLanguage', async () => {
            const formData = await newLanguagePrompt()?.showModal();
            const locale = formData?.get('locale')?.toString();

            if (!locale) {
                return;
            }

            api()?.addLocale(locale);
        }),
    } as const;

    return <div class={css.root}>
        <Command.Add commands={[commands.saveAs, commands.closeTab]} />

        <Context.Menu>{
            command => <Command.Handle command={command} />
        }</Context.Menu>

        <Menu.Root>
            <Menu.Item label={t('page.edit.menu.file')}>
                <Menu.Item command={commands.open} />

                <Menu.Item command={commands.close} />

                <Menu.Separator />

                <Menu.Item command={commands.save} />
            </Menu.Item>

            <Menu.Item label={t('page.edit.menu.edit')}>
                <Menu.Item command={commands.insertKey} />

                <Menu.Item command={commands.insertLanguage} />

                <Menu.Separator />

                <Menu.Item command={commands.delete} />
            </Menu.Item>

            <Menu.Item label={t('page.edit.menu.selection')}>
                <Menu.Item command={commands.selectAll} />

                <Menu.Item command={commands.clearSelection} />
            </Menu.Item>
        </Menu.Root>

        <Prompt api={setNewKeyPrompt} title={t('page.edit.prompt.newKey.title')} description={t('page.edit.prompt.newKey.description')}>
            <input name="key" placeholder={t('page.edit.prompt.newKey.placeholder')} />
        </Prompt>

        <Prompt api={setNewLanguagePrompt} title={t('page.edit.prompt.newLanguage.title')}>
            <input name="locale" placeholder={t('page.edit.prompt.newLanguage.placeholder')} />
        </Prompt>

        <Sidebar as="aside" label={tree().name} class={css.sidebar}>
            <Tree entries={tree().entries}>{[
                folder => {
                    return <span onDblClick={() => {
                        filesContext?.set(folder().name, folder().handle);
                    }}>{folder().name}</span>;
                },
                file => {
                    const mutated = createMemo(() => mutatedFiles().values().find(({ id }) => id === file().id) !== undefined);

                    return <Context.Handle class={`${mutated() ? css.mutated : ''}`} onDblClick={() => {
                        const folder = file().directory;
                        filesContext?.set(folder.name, folder);
                        setActive(folder.name);
                    }}>{file().name}</Context.Handle>;
                },
            ] as const}</Tree>
        </Sidebar>

        <Tabs class={css.content} active={active()} setActive={setActive} onClose={commands.closeTab}>
            <For each={tabs()}>{
                ({ key, handle, setApi, setEntries }) => <Tab id={key} label={handle.name} closable>
                    <Content directory={handle} api={setApi} entries={setEntries} />
                </Tab>
            }</For>
        </Tabs>
    </div>;
};

const Content: Component<{ directory: FileSystemDirectoryHandle, api?: Setter<(GridApi & { addLocale(locale: string): void }) | undefined>, entries?: Setter<Entries> }> = (props) => {
    const [entries, setEntries] = createSignal<Entries>(new Map());
    const [locales, setLocales] = createSignal<string[]>([]);
    const [rows, setRows] = createSignal<Entry[]>([]);
    const [api, setApi] = createSignal<GridApi>();

    createEffect(() => {
        props.entries?.(entries());
    });

    createEffect(() => {
        const a = api();

        if (!a) {
            return;
        }

        props.api?.({
            ...a,
            addLocale(locale) {
                setLocales(current => new Set([...current, locale]).values().toArray());
            },
        });
    });

    createEffect(() => {
        const directory = props.directory;

        if (!directory) {
            return;
        }

        (async () => {
            const contents = await Array.fromAsync(
                filter(directory.values(), (handle): handle is FileSystemFileHandle => handle.kind === 'file' && handle.name.endsWith('.json')),
                async handle => {
                    const id = await handle.getUniqueId();
                    const file = await handle.getFile();
                    const lang = file.name.split('.').at(0)!;
                    const entries = (await load(file))!;

                    return { id, handle, lang, entries };
                }
            );
            const template = contents.map(({ lang, handle }) => [lang, { handle, value: '' }]);

            setLocales(contents.map(({ lang }) => lang));

            const merged = contents.reduce((aggregate, { id, handle, lang, entries }) => {
                for (const [key, value] of entries.entries()) {
                    if (!aggregate.has(key)) {
                        aggregate.set(key, Object.fromEntries(template));
                    }

                    aggregate.get(key)![lang] = { value, handle, id };
                }

                return aggregate;
            }, new Map<string, Record<string, { id: string, value: string, handle: FileSystemFileHandle }>>());

            setEntries(new Map(merged.entries().map(([key, langs], i) => [i.toString(), { key, ...langs }])) as Entries);
            setRows(merged.entries().map(([key, langs]) => ({ key, ...Object.fromEntries(Object.entries(langs).map(([lang, { value }]) => [lang, value])) } as Entry)).toArray());
        })();
    });

    return <Grid rows={rows()} locales={locales()} api={setApi} />;
};

const Blank: Component<{ open: CommandType }> = (props) => {
    return <div class={css.blank}>
        <EditBlankImage />

        <button onpointerdown={() => props.open()}>open a folder</button>
    </div>
};