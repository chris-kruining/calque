import { Component, createContext, createEffect, createResource, Match, ParentComponent, Show, Suspense, Switch, useContext } from "solid-js";
import { action, query, useAction } from "@solidjs/router";
import { useSession } from "vinxi/http";
import { createStore } from "solid-js/store";
import { Dropdown } from "./dropdown";
import { WiMoonAltFull, WiMoonAltNew, WiMoonAltFirstQuarter } from "solid-icons/wi";
import css from './colorschemepicker.module.css';

export enum ColorScheme {
    Auto = 'light dark',
    Light = 'light',
    Dark = 'dark',
}

const colorSchemes: Record<ColorScheme, keyof typeof ColorScheme> = Object.fromEntries(Object.entries(ColorScheme).map(([k, v]) => [v, k] as const)) as any;

export interface State {
    colorScheme: ColorScheme;
    hue: number;
}

const getSession = async () => {
    'use server';

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

const useStore = () => useContext(ThemeContext)!;

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

export const ColorSchemePicker: Component = (props) => {
    const { theme, setColorScheme, setHue } = useStore();

    return <>
        <label aria-label="Color scheme picker">
            <Dropdown id="color-scheme-picker" class={css.picker} value={theme.colorScheme} setValue={(next) => setColorScheme(next())} values={colorSchemes}>{
                (k, v) => <>
                    <Switch>
                        <Match when={k === ColorScheme.Auto}><WiMoonAltFirstQuarter /></Match>
                        <Match when={k === ColorScheme.Light}><WiMoonAltNew /></Match>
                        <Match when={k === ColorScheme.Dark}><WiMoonAltFull /></Match>
                    </Switch>
                    {v}
                </>
            }</Dropdown>
        </label>

        <label class={css.hue} aria-label="Hue slider">
            <input type="range" min="0" max="360" value={theme.hue} onInput={e => setHue(e.target.valueAsNumber)} />
        </label>
    </>;
};