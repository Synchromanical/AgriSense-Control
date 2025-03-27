import React, { useState, useContext, useEffect } from "react";
import { SensorContext } from "../SensorContext";
import styles from "../Sensor.module.css"; 

const Sensor = () => {
  const { activeSensors, addSensor, removeSensor, clearSensors } = useContext(SensorContext);
  const [selectedSensor, setSelectedSensor] = useState("");
  const [selectedNode, setSelectedNode] = useState("1");

  // Load the last selected sensor from localStorage if available.
  useEffect(() => {
    const savedSensor = localStorage.getItem("selectedSensor");
    if (savedSensor) {
      setSelectedSensor(savedSensor);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedSensor", selectedSensor);
  }, [selectedSensor]);

  const handleSaveInstance = () => {
    if (!selectedSensor) return;
    addSensor(selectedSensor);
  };

  const handleDeleteSingle = (sensor) => {
    removeSensor(sensor);
  };

  const handleClearAll = () => {
    clearSensors();
  };

  return (
    <div className={styles.sensorContent}>
      <h2>Sensor Manager</h2>
      <div className={styles.sensorGrid}>
        <h3 className={styles.instanceConfigTitle}>Instance Configuration</h3>

        {/* Sensor selection */}
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
              <option value="Water Level">Water Level</option>
              <option value="Light">Light</option>
            </select>
          </div>
        </div>

        {/* Node selection */}
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

        {/* Save button */}
        <div className={styles.buttonRow}>
          <button className={styles.saveButton} onClick={handleSaveInstance}>
            Save Instance
          </button>
        </div>

        {/* Active Sensors list */}
        <h4 className={styles.automationHeading}>Active Sensors</h4>
        {activeSensors.length === 0 && <p>No active sensors yet.</p>}
        {activeSensors.map((sensor, index) => (
          <div key={index} className={styles.automationItemRow}>
            <div>
              <strong>{sensor}</strong> (Node {selectedNode})
            </div>
            <div>
              <button
                onClick={() => handleDeleteSingle(sensor)}
                className={`${styles.setButton} ${styles.automationToggleButton}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {activeSensors.length > 0 && (
          <button onClick={handleClearAll} className={`${styles.setButton} ${styles.automationClearButton}`}>
            Clear All Sensors
          </button>
        )}
      </div>
    </div>
  );
};

export default Sensor;
