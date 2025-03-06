import { createEffect, createSignal, on } from "solid-js";
import { readFiles } from "~/features/file";
import { contentsOf } from "~/features/file/helpers";

export default function FileObserver(props: {}) {
    const [dir, setDir] = createSignal<FileSystemDirectoryHandle>();

    const files = readFiles(dir);
    const contents = contentsOf(dir);

    const open = async () => {
        const handle = await window.showDirectoryPicker();

        setDir(handle)
    };

    createEffect(() => {
        console.log('dir', dir());
    });

    createEffect(() => {
        console.log('files', files());
    });

    createEffect(() => {
        console.log('contents', contents());
    });

    return <div>
        <button onclick={open}>Select folder</button>
    </div>;
}