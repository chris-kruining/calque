import { WiMoonAltFirstQuarter, WiMoonAltFull, WiMoonAltNew } from "solid-icons/wi";
import { Component, createEffect, createSignal, Match, Switch } from "solid-js";
import { Select } from "~/components/select";
import { ColorScheme, useStore } from "./context";
import css from './picker.module.css';

const colorSchemes: Record<ColorScheme, keyof typeof ColorScheme> = Object.fromEntries(Object.entries(ColorScheme).map(([k, v]) => [v, k] as const)) as any;

export const ColorSchemePicker: Component = (props) => {
    const { theme, setColorScheme, setHue } = useStore();
    const [scheme, setScheme] = createSignal<ColorScheme>(theme.colorScheme);

    createEffect(() => {
        const next = scheme();

        if (!next) {
            return;
        }

        setColorScheme(next);
    });

    return <>
        <label aria-label="Color scheme picker">
            <Select id="color-scheme-picker" class={css.picker} value={theme.colorScheme} setValue={setScheme} values={colorSchemes}>{
                (k, v) => <>
                    <Switch>
                        <Match when={k === ColorScheme.Auto}><WiMoonAltFirstQuarter /></Match>
                        <Match when={k === ColorScheme.Light}><WiMoonAltNew /></Match>
                        <Match when={k === ColorScheme.Dark}><WiMoonAltFull /></Match>
                    </Switch>
                    {v}
                </>
            }</Select>
        </label>

        <label class={css.hue} aria-label="Hue slider">
            <input type="range" min="0" max="360" value={theme.hue} onInput={e => setHue(e.target.valueAsNumber)} />
        </label>
    </>;
};