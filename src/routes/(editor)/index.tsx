import { useNavigate } from "@solidjs/router";
import { createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import { useFiles } from "~/features/file/context";

export default function Index() {
  const navigate = useNavigate();
  const files = useFiles();

  createEffect(() => {
    const root = files.root();

    if (isServer) {
      return;
    }

    navigate(root !== undefined ? '/edit' : '/welcome');
  });

  return <section style="display: grid; place-content: center;">
    <span>Loading, one moment please</span>
  </section>;
}
