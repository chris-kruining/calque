
import { ErrorBoundary, ParentProps } from "solid-js";
import { Menu } from "~/features/menu";
import { createCommand } from "~/features/command";
import { useNavigate } from "@solidjs/router";
import { ErrorComp } from "~/components/error";

export default function Experimental(props: ParentProps) {
  const navigate = useNavigate();

  const goTo = createCommand('go to', (to: string) => {
    navigate(`/experimental/${to}`);
  });

  return <>
    <Menu.Root>
      <Menu.Item command={goTo.withLabel('table').with('table')} />
      <Menu.Item command={goTo.withLabel('grid').with('grid')} />
      <Menu.Item command={goTo.withLabel('context-menu').with('context-menu')} />
      <Menu.Item command={goTo.withLabel('formatter').with('formatter')} />
    </Menu.Root>

    <ErrorBoundary fallback={e => <ErrorComp error={e} />}>
      {props.children}
    </ErrorBoundary>
  </>;
}