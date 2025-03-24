import React, { useState, useContext, useEffect } from "react";
import { SensorContext } from "../SensorContext";
import styles from "../Sensor.module.css"; 

const Sensor = () => {
  const { activeSensors, addSensor, removeSensor, clearSensors, selectedInstance } = useContext(SensorContext);
  const [selectedSensor, setSelectedSensor] = useState("");
  // Local state to let the user choose which node the sensor is saved to
  const [selectedNode, setSelectedNode] = useState(selectedInstance);

  // Sync the local selectedNode with the global selectedInstance when it changes
  useEffect(() => {
    setSelectedNode(selectedInstance);
  }, [selectedInstance]);

  const handleSaveInstance = () => {
    if (!selectedSensor) return;
    addSensor(selectedNode, selectedSensor);
  };

  const handleDeleteSingle = (sensor) => {
    removeSensor(selectedInstance, sensor);
  };

  const handleClearAll = () => {
    clearSensors(selectedInstance);
  };

  // Only display sensors saved for the current global instance
  const sensorsForCurrentInstance = activeSensors[selectedInstance] || [];

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
        <h4 className={styles.automationHeading}>Active Sensors (Instance {selectedInstance})</h4>
        {sensorsForCurrentInstance.length === 0 && <p>No active sensors yet.</p>}
        {sensorsForCurrentInstance.map((sensor, index) => (
          <div key={index} className={styles.automationItemRow}>
            <div>
              <strong>{sensor}</strong> (Node {selectedInstance})
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
        {sensorsForCurrentInstance.length > 0 && (
          <button onClick={handleClearAll} className={`${styles.setButton} ${styles.automationClearButton}`}>
            Clear All Sensors
          </button>
        )}
      </div>
    </div>
  );
};

export default Sensor;
