import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Graph from "./components/Graph";
import Logs from "./components/Logs";
import ControlPanel from "./components/ControlPanel";

import styles from "./App.module.css";

function App() {
  return (
    <Router>
      {/* NavBar */}
      <nav className={styles.navBar}>
        <Link to="/" className={styles.navLink}>
          Dashboard
        </Link>
        <Link to="/graph" className={styles.navLink}>
          Graph
        </Link>
        <Link to="/logs" className={styles.navLink}>
          Logs
        </Link>
        <Link to="/control-panel" className={styles.navLink}>
          Control Panel
        </Link>
      </nav>

      {/* Main Container (pushes content below fixed nav) */}
      <div className={styles.container}>
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
