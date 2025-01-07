import { Link, Meta, Title } from "@solidjs/meta";
import { Component, createMemo, createSignal, ErrorBoundary, ParentProps, Show } from "solid-js";
import { FilesProvider } from "~/features/file";
import { Menu, MenuProvider } from "~/features/menu";
import { A, RouteDefinition, useBeforeLeave } from "@solidjs/router";
import { CommandPalette, CommandPaletteApi, createCommand, Modifier } from "~/features/command";
import { getRequestEvent } from "solid-js/web";
import { HttpHeader } from "@solidjs/start";
import { FaSolidPalette } from "solid-icons/fa";
import { LocalePicker } from "~/features/i18n";
import { ColorScheme, ColorSchemePicker, getState, useTheme } from "~/features/theme";
import css from "./editor.module.css";
import { Dropdown } from "~/components/dropdown";

const event = getRequestEvent();

export const route: RouteDefinition = {
    preload: () => {
        return getState();
    },
};

export default function Editor(props: ParentProps) {
    const theme = useTheme();
    const themeMenuId = createUniqueId();

    const [commandPalette, setCommandPalette] = createSignal<CommandPaletteApi>();
    const colorScheme = createMemo(() => (theme.colorScheme === ColorScheme.Auto ? event?.request.headers.get('Sec-CH-Prefers-Color-Scheme') : theme.colorScheme) ?? 'light dark');
    const lightness = createMemo(() => colorScheme() === ColorScheme.Light ? .9 : .2);

    const commands = [
        createCommand('shell.command.openCommandPalette', () => {
            commandPalette()?.show();
        }, { key: 'p', modifier: Modifier.Control | Modifier.Shift }),
    ];

    const transition = (done: () => void) => {
        if (!document.startViewTransition) { return done() }

        const transition = document.startViewTransition(done)
    }

    useBeforeLeave((e) => {
        e.preventDefault();

        transition(() => { e.retry(true) })
    });

    return <MenuProvider commands={commands}>
        <HttpHeader name="Accept-CH" value="Sec-CH-Prefers-Color-Scheme" />

        <Title>Calque</Title>
        <Meta name="description" content="Simple tool for managing translation files" />

        <Meta name="color-scheme" content={colorScheme()} />
        <Meta name="theme-color" content={`oklch(${lightness()} .02 ${theme.hue ?? 0})`} />

        <style>{`
            :root {
                --hue: ${theme.hue ?? 0}deg !important;
            }
        `}</style>

        <Link rel="icon" href="/images/favicon.dark.svg" media="screen and (prefers-color-scheme: dark)" />
        <Link rel="icon" href="/images/favicon.light.svg" media="screen and (prefers-color-scheme: light)" />
        <Link rel="manifest" href="/manifest.json" />

        <main class={css.layout} inert={commandPalette()?.open()}>
            <nav class={css.menu}>
                <A class={css.logo} href="/welcome">
                    <picture>
                        <source srcset="/images/favicon.dark.svg" media="screen and (prefers-color-scheme: dark)" />
                        <source srcset="/images/favicon.light.svg" media="screen and (prefers-color-scheme: light)" />
                        <img src="/images/favicon.dark.svg" alt="Calque logo" width="17.5" height="17.5" />
                    </picture>
                </A>

                <Menu.Mount />

                <section class={css.right}>
                    <LocalePicker />

                    <Dropdown id={themeMenuId} class={css.themeMenu} text={<FaSolidPalette />}>
                        <ColorSchemePicker />
                    </Dropdown>
                </section>
            </nav>

            <section>
                <ErrorBoundary fallback={err => <ErrorComp error={err} />}>
                    <FilesProvider>
                        {props.children}
                    </FilesProvider>
                </ErrorBoundary>
            </section>
        </main>

        <CommandPalette api={setCommandPalette} />
    </MenuProvider>
}

const ErrorComp: Component<{ error: Error }> = (props) => {
    return <div class={css.error}>
        <b>{props.error.message}</b>

        <Show when={props.error.cause}>{
            cause => <>{cause().description}</>
        }</Show>

        {props.error.stack}

        <a href="/">Return to start</a>
    </div>;
};

let keyCounter = 0;
const createUniqueId = () => `key-${keyCounter++}`;