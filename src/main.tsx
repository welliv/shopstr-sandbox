import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { init } from "@getalby/bitcoin-connect-react";
import { ThemeProvider } from "./components/theme-provider";
import "./index.css";
import App from "./App.tsx";

init({
  appName: "Shopstr Lightning Playground",
  showBalance: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);
