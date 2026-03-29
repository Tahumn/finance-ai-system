import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./insight.css";


const appMode = import.meta.env.VITE_APP_MODE || "auto";
if (typeof document !== "undefined") {
  document.body.dataset.appMode = appMode;
  if (appMode === "mobile") document.title = "Finance AI Mobile";
  if (appMode === "web") document.title = "Finance AI Web";
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
