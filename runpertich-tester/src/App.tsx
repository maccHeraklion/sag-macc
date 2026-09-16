import React, { useState } from "react";
import type { AppState, TabId } from "./types";
import ConfigTab from "./tabs/ConfigTab";
import DashboardTab from "./tabs/DashboardTab";

const initialState: AppState = {
  activeTab: "config",
  runPerTichCode: "",
  suiteResult: null,
  simulationStatus: "idle",
  simulationProgress: { completed: 0, total: 0 },
  simulationLog: [],
  simulationError: null,
  virtualTime: null,
  dataset: null,
};

export default function App() {
  const [state, setState] = useState<AppState>(initialState);

  const setTab = (tab: TabId) => setState((s) => ({ ...s, activeTab: tab }));

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">⚙️</span>
        <h1>runPerTich Tester</h1>
        <nav className="tab-nav">
          <button
            className={`tab-btn ${state.activeTab === "config" ? "active" : ""}`}
            onClick={() => setTab("config")}
          >
            1. Configure &amp; Test
          </button>
          <button
            className={`tab-btn ${state.activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setTab("dashboard")}
            disabled={state.dataset === null}
            title={state.dataset === null ? "Load a dataset first" : undefined}
          >
            2. Virtual Dashboard
          </button>
        </nav>
      </header>

      <main className="app-main">
        {state.activeTab === "config" && (
          <ConfigTab state={state} setState={setState} />
        )}
        {state.activeTab === "dashboard" && (
          <DashboardTab state={state} setState={setState} />
        )}
      </main>
    </div>
  );
}
