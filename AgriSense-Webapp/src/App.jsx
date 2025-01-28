import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Graph from "./components/Graph";
import Logs from "./components/Logs";
import ControlPanel from "./components/ControlPanel";

function App() {
  return (
    <Router>
      <div className="container">
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/graph">Graph</Link>
          <Link to="/logs">Logs</Link>
          <Link to="/control-panel">Control Panel</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/control-panel" element={<ControlPanel />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
