import { action, query, useAction } from "@solidjs/router";
import { createContext, createEffect, createResource, ParentComponent, Show, Suspense, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { useSession } from "vinxi/http";


export enum ColorScheme {
    Auto = 'light dark',
    Light = 'light',
    Dark = 'dark',
}

export interface State {
    colorScheme: ColorScheme;
    hue: number;
}

const getSession = async () => {
    'use server';

    console.log(process.env.SESSION_SECRET);

    return useSession<State>({
        password: process.env.SESSION_SECRET!,
    });
};

export const getState = query(async () => {
    'use server';

    const session = await getSession();

    return session.data;
}, 'color-scheme');

const setState = action(async (state: State) => {
    'use server';

    const session = await getSession();
    await session.update(prev => ({ ...prev, ...state }));
}, 'color-scheme');

interface ThemeContextType {
    readonly theme: State;
    setColorScheme(colorScheme: ColorScheme): void;
    setHue(hue: number): void;
}

const ThemeContext = createContext<ThemeContextType>();

export const useStore = () => useContext(ThemeContext)!;

export const useTheme = () => {
    const ctx = useContext(ThemeContext);

    if (ctx === undefined) {
        throw new Error('useColorScheme is called outside a <ColorSchemeProvider />');
    }

    return ctx.theme;
};

export const ThemeProvider: ParentComponent = (props) => {
    const [state, { mutate }] = createResource<State>(() => getState(), { deferStream: true });
    const updateState = useAction(setState);

    return <Suspense>
        <Show when={state()}>{state => {
            const [store, setStore] = createStore(state());

            createEffect(() => {
                setStore(state());
            });

            return <ThemeContext.Provider value={{
                get theme() { return store; },
                setColorScheme(colorScheme: ColorScheme) { updateState(mutate(prev => ({ colorScheme, hue: prev?.hue ?? 0 }))) },
                setHue(hue: number) { updateState(mutate(prev => ({ hue, colorScheme: prev?.colorScheme ?? ColorScheme.Auto }))) },
            }}>
                {props.children}
            </ThemeContext.Provider>;
        }}</Show>
    </Suspense>;
};