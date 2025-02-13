import { createEffect, createSignal, Signal } from "solid-js";
import { Parser, RichTextAST } from "./parser";

export interface Source<TIn extends Parser, TOut extends Parser> {
    readonly in: Signal<string>;
    readonly out: Signal<string>;
}

export function createSource<TIn extends Parser, TOut extends Parser>(inParser: TIn, outParser: TOut, initalValue: string): Source<TIn, TOut> {
    const [inValue, setIn] = createSignal<string>(initalValue);
    const [outValue, setOut] = createSignal<string>('');

    const [ast, setAst] = createSignal<RichTextAST>();

    createEffect(() => {
        setAst(inParser.parse(inValue()));
    });

    createEffect(() => {
        setAst(outParser.parse(outValue()));
    });

    return {
        get in() {
            return [inValue, setIn] as Signal<string>;
        },
        get out() {
            return [outValue, setOut] as Signal<string>;
        },
    };
}