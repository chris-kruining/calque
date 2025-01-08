import { Sidebar } from "~/components/sidebar";
import { Command, Context, createCommand, Modifier } from "~/features/command";
import { createSignal } from "solid-js";
import css from './context-menu.module.css';

export default function ContextMenu(props: {}) {
    const [message, setMessage] = createSignal('');

    const commands = {
        back: createCommand('Back', () => setMessage('Back command is triggered'), { key: '[', modifier: Modifier.Control }),
        forward: createCommand('Forward', () => setMessage('forward command is triggered'), { key: ']', modifier: Modifier.Control }),
        reload: createCommand('Reload', () => setMessage('reload command is triggered'), { key: 'r', modifier: Modifier.Control }),
        showBookmarks: createCommand('Show bookmarks', () => setMessage('showBookmarks command is triggered'), { key: 'b', modifier: Modifier.Control }),
        showFullUrls: createCommand('Show full URL\'s', () => setMessage('showFullUrls command is triggered')),
        allModifiers: createCommand('shell.command.openCommandPalette', () => setMessage('allModifiers command is triggered'), { key: 'a', modifier: Modifier.Alt | Modifier.Control | Modifier.Meta | Modifier.Shift }),
    };

    return <div class={css.root}>
        <Sidebar as="aside" label={'Options'} class={css.sidebar}>
            <fieldset>
                <legend>Message</legend>

                <p>{message()}</p>
            </fieldset>
        </Sidebar>

        <div class={css.content}>
            <Context.Root commands={Object.values(commands)}>
                <Context.Menu>{
                    command => <Command.Handle command={command} />
                }</Context.Menu>

                <Context.Handle>Right click on me</Context.Handle>
            </Context.Root>
        </div>
    </div >;
}