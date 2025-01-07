import { MetaProvider } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { ThemeProvider } from "./features/theme";
import { I18nProvider } from "./features/i18n";
import "./app.css";

export default function App() {
  return (
    <Router
      root={props => (
        <MetaProvider>
          <ThemeProvider>
            <I18nProvider>
              <Suspense>{props.children}</Suspense>
            </I18nProvider>
          </ThemeProvider>
        </ MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
