import { createContextProvider } from "@solid-primitives/context";
import { createEffect, ParentProps } from "solid-js";
import { createEditor } from "./context";


const [EditorProvider, useEditor] = createContextProvider((props: { ref: Element, value: string }) => {
    const [text] = createEditor(() => props.ref, () => props.value);

    createEffect(() => {
        console.log(text());
    });

    return { text };
});

export { useEditor };

export function Editor(props: ParentProps<{ ref: Element, value: string }>) {
    return <EditorProvider ref={props.ref} value={props.value}>{props.children}</EditorProvider>;
}