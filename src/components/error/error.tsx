import { Component, Show } from "solid-js";
import css from './error.module.css';

export const ErrorComp: Component<{ error: Error }> = (props) => {
    return <div class={css.error}>
        <b>{props.error.message}</b>

        <Show when={props.error.cause}>{
            cause => <>{cause().description}</>
        }</Show>

        {props.error.stack}

        <a href="/">Return to start</a>
    </div>;
};