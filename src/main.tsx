import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

/**
 * Sitemap / deep links use clean paths (/about). HashRouter expects /#/about.
 * Remap pathname → hash before React mounts so crawlers and shared links work.
 */
function syncPathnameToHashRouter() {
  const { pathname, search, hash } = window.location;
  if (pathname === "/" || pathname === "") return;
  if (hash && hash !== "#" && hash !== "#/") return;
  const target = `/#${pathname}${search || ""}`;
  window.history.replaceState(null, "", target);
}

syncPathnameToHashRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
