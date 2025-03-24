import React, { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Graph from "./components/Graph";
import Logs from "./components/Logs";
import ControlPanel from "./components/ControlPanel";
import Sensor from "./components/Sensor";
import { SensorContext } from "./SensorContext";
import styles from "./App.module.css";

function App() {
  const { selectedInstance, setSelectedInstance } = useContext(SensorContext);

  return (
    <Router>
      <nav className={styles.navBar}>
        {/* Centered links container */}
        <div className={styles.navLinksContainer}>
          <Link to="/" className={styles.navLink}>Dashboard</Link>
          <Link to="/graph" className={styles.navLink}>Graph</Link>
          <Link to="/logs" className={styles.navLink}>Logs</Link>
          <Link to="/control-panel" className={styles.navLink}>Control Panel</Link>
          <Link to="/sensor" className={styles.navLink}>Sensor</Link>
        </div>
        {/* Dropdown on the far right */}
        <div className={styles.instanceDropdownContainer}>
          <select
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
          >
            <option value="1">Instance 1</option>
            <option value="2">Instance 2</option>
          </select>
        </div>
      </nav>

      <div className={styles.container}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/control-panel" element={<ControlPanel />} />
          <Route path="/sensor" element={<Sensor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
