import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";

import {
  CasinoProvider
} from "./context/CasinoContext";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <CasinoProvider>
      <App />
    </CasinoProvider>
  </React.StrictMode>
);