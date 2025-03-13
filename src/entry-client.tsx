// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import { installIntoGlobal } from "iterator-helpers-polyfill";
import 'solid-devtools';

installIntoGlobal();

mount(() => <StartClient />, document.body);
