import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

console.log("main.tsx loaded");

const container = document.getElementById("root");

if (!container) {
  console.error("Δεν βρέθηκε #root στο DOM");
} else {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
