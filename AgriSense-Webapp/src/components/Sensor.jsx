import React, { useState, useContext, useEffect } from "react";
import { SensorContext } from "../SensorContext";
import styles from "../Sensor.module.css";

const Sensor = () => {
  const { activeSensors, addSensor, removeSensor, clearSensors, selectedInstance } = useContext(SensorContext);
  const [selectedSensor, setSelectedSensor] = useState("");
  // Board type defaults to GSMB (as before)
  const [boardType, setBoardType] = useState("GSMB");
  // Local state to let the user choose which node the sensor is saved to
  const [selectedNode, setSelectedNode] = useState(selectedInstance);

  // Sync the local selectedNode with the global selectedInstance when it changes
  useEffect(() => {
    setSelectedNode(selectedInstance);
  }, [selectedInstance]);

  // Updated sensor options:
  // - GSMB: remains unchanged.
  // - HPCB: now includes Fan, Light, and Humidifier sensors with numbers 1-3.
  // - NSCB: now includes Water Level along with Nutrient Level 1 and Nutrient Level 2.
  const sensorOptionsByBoardType = {
    GSMB: ["Temperature", "Humidity", "Soil Moisture"],
    HPCB: [
      "Fan 1", "Fan 2", "Fan 3",
      "Light 1", "Light 2", "Light 3",
      "Humidifier 1", "Humidifier 2", "Humidifier 3"
    ],
    NSCB: ["Water Level", "Nutrient 1 Level", "Nutrient 2 Level"],
  };

  // Mutually exclusive groups for HPCB: for a given number, only one sensor (of type Fan, Light, or Humidifier) can be active.
  const mutuallyExclusiveTypes = ["Fan", "Light", "Humidifier"];

  // Disable an option if any sensor from the mutually exclusive groups with the same number is active.
  // This logic applies only for HPCB.
  const isOptionDisabled = (option) => {
    const tokens = option.split(" ");
    if (tokens.length < 2) return false;
    const [optionType, optionNumber] = tokens;
    if (!mutuallyExclusiveTypes.includes(optionType)) return false;
    // Check active sensors for the current instance.
    for (const sensor of activeSensors[selectedInstance] || []) {
      const sensorTokens = sensor.split(" ");
      if (sensorTokens.length < 2) continue;
      const [activeType, activeNumber] = sensorTokens;
      if (mutuallyExclusiveTypes.includes(activeType) && activeNumber === optionNumber) {
        return true;
      }
    }
    return false;
  };

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

        {/* Board Type row */}
        <div className={styles.formRow}>
          <div className={styles.leftColumn}>
            <label className={styles.sensorLabel}>Board Type:</label>
          </div>
          <div className={styles.rightColumn}>
            <select
              value={boardType}
              onChange={(e) => {
                setBoardType(e.target.value);
                setSelectedSensor(""); // reset sensor selection when board type changes
              }}
              className={styles.sensorDropdown}
            >
              <option value="GSMB">GSMB</option>
              <option value="HPCB">HPCB</option>
              <option value="NSCB">NSCB</option>
            </select>
          </div>
        </div>

        {/* Sensor/Variable selection row */}
        <div className={styles.formRow}>
          <div className={styles.leftColumn}>
            <label className={styles.sensorLabel}>Variable:</label>
          </div>
          <div className={styles.rightColumn}>
            <select
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
              className={styles.sensorDropdown}
            >
              <option value="">-- Select a Variable --</option>
              {sensorOptionsByBoardType[boardType].map((option) => (
                <option
                  key={option}
                  value={option}
                  disabled={boardType === "HPCB" && isOptionDisabled(option)}
                >
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Node selection row */}
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
