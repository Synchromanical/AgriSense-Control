import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Graph from "./components/Graph";
import Logs from "./components/Logs";
import ControlPanel from "./components/ControlPanel";
// Import the new Sensor component
import Sensor from "./components/Sensor";

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
        {/* <-- Add the new Sensor link */}
        <Link to="/sensor" className={styles.navLink}>
          Sensor
        </Link>
      </nav>

      {/* Main Container */}
      <div className={styles.container}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/control-panel" element={<ControlPanel />} />
          {/* <-- Add the new /sensor route */}
          <Route path="/sensor" element={<Sensor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
