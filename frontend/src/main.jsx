import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./insight.css";

const envAppMode = import.meta.env.VITE_APP_MODE || "auto";
if (typeof document !== "undefined") {
  const resolvedMode =
    envAppMode === "auto"
      ? window.matchMedia?.("(max-width: 520px)")?.matches
        ? "mobile"
        : "web"
      : envAppMode;
  document.body.dataset.appMode = resolvedMode;
  if (resolvedMode === "mobile") document.title = "Finanzy AI Mobile";
  if (resolvedMode === "web") document.title = "Finanzy AI Web";
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
