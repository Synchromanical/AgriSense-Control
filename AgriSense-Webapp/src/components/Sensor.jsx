// src/components/Sensor.jsx
import React, { useState } from "react";
// Optionally import from ControlPanel.module.css if you want the same classes
// or replicate them in Sensor.module.css
import styles from "../Sensor.module.css"; 

const Sensor = () => {
  const [selectedSensor, setSelectedSensor] = useState("");
  const [selectedNode, setSelectedNode] = useState("1");
  const [activeSensors, setActiveSensors] = useState([]);

  // Save a new sensor instance
  const handleSaveInstance = () => {
    if (!selectedSensor) return;
    const newEntry = {
      id: Date.now().toString(),
      sensor: selectedSensor,
      node: selectedNode,
    };
    setActiveSensors((prev) => [...prev, newEntry]);
  };

  // Delete a single sensor by id
  const handleDeleteSingle = (idToDelete) => {
    setActiveSensors((prev) => prev.filter((item) => item.id !== idToDelete));
  };

  // Clear all sensors
  const handleClearAll = () => {
    setActiveSensors([]);
  };

  return (
    <div className={styles.sensorContent}>
      <div className={styles.sensorGrid}>
        <h3 className={styles.instanceConfigTitle}>Instance Configuration</h3>

        {/* Sensor + dropdown */}
        <div className={styles.formRow}>
          <div className={styles.leftColumn}>
            <label className={styles.sensorLabel}>Sensor:</label>
          </div>
          <div className={styles.rightColumn}>
            <select
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
              className={styles.sensorDropdown}
            >
              <option value="">-- Select a Sensor --</option>
              <option value="Temperature">Temperature</option>
              <option value="Humidity">Humidity</option>
              <option value="Soil Moisture">Soil Moisture</option>
              <option value="Capacitive (Water)">Capacitive (Water)</option>
              <option value="Light">Light</option>
            </select>
          </div>
        </div>

        {/* Node + radio buttons */}
        <div className={styles.formRow}>
          <div className={styles.leftColumn}>
            <label className={styles.sensorLabel}>Node:</label>
          </div>
          <div className={styles.rightColumn}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="node"
                value="1"
                checked={selectedNode === "1"}
                onChange={() => setSelectedNode("1")}
              />
              1
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="node"
                value="2"
                checked={selectedNode === "2"}
                onChange={() => setSelectedNode("2")}
              />
              2
            </label>
          </div>
        </div>

        {/* Save Instance button */}
        <div className={styles.buttonRow}>
          <button className={styles.saveButton} onClick={handleSaveInstance}>
            Save Instance
          </button>
        </div>

        {/* Active sensors list (similar to "Existing Automations") */}
        <h4 className={styles.automationHeading}>Active Sensors</h4>
        {activeSensors.length === 0 && <p>No active sensors yet.</p>}
        {activeSensors.map((item) => (
          <div key={item.id} className={styles.automationItemRow}>
            <div>
              <strong>{item.sensor}</strong> (Node {item.node})
            </div>
            <div>
              <button
                onClick={() => handleDeleteSingle(item.id)}
                className={`${styles.setButton} ${styles.automationToggleButton}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {/* Clear All Sensors button */}
        {activeSensors.length > 0 && (
          <button
            onClick={handleClearAll}
            className={`${styles.setButton} ${styles.automationClearButton}`}
          >
            Clear All Sensors
          </button>
        )}
      </div>
    </div>
  );
};

export default Sensor;
