// Sensor.jsx
import React, { useState, useContext, useEffect } from "react";
import { SensorContext } from "../SensorContext";
import styles from "../Sensor.module.css";

// 1) Create an object that groups your sensors by board type, but uses numeric indexes.
const sensorOptionsByBoardType = {
  GSMB: [
    "Temperature", 
    "Humidity", 
    "Soil Moisture"
  ],
  HPCB: [
    "Fan 1", "Fan 2", "Fan 3",
    "Light 1", "Light 2", "Light 3",
    "Humidifier 1", "Humidifier 2", "Humidifier 3",
  ],
  NSCB: [
    "Water Level", 
    "Nutrient 1 Level", 
    "Nutrient 2 Level"
  ],
};

// 2) Helper function to get the slot number (“1”, “2”, or “3”) from a sensor name.
function getSensorSlot(sensorName) {
  // For instance, “Light 1” -> "1", “Fan 1” -> "1".
  // We'll search for the trailing digit with a simple RegExp or parseInt approach.
  const match = sensorName.match(/\b(\d)\b/); 
  return match ? match[1] : null; // e.g. “1”
}

const Sensor = () => {
  const { activeSensors, addSensor, removeSensor, clearSensors, selectedInstance } = useContext(SensorContext);
  const [selectedSensor, setSelectedSensor] = useState("");
  const [boardType, setBoardType] = useState("GSMB");
  const [selectedNode, setSelectedNode] = useState(selectedInstance);

  useEffect(() => {
    setSelectedNode(selectedInstance);
  }, [selectedInstance]);

  // CHANGED: Extract the active sensors for the current instance
  const sensorsForCurrentInstance = activeSensors[selectedInstance] || [];

  /**
   * 3) Build a set of “occupied slots” for the current instance’s sensors.
   *    e.g. if “Light 1” is chosen, slot 1 is occupied, so “Fan 1” or “Humidifier 1” must be disabled.
   */
  const occupiedSlots = new Set();
  // We only care about sensors that end in “1”, “2”, or “3”.
  sensorsForCurrentInstance.forEach((existingSensor) => {
    const slot = getSensorSlot(existingSensor); 
    if (slot) {
      occupiedSlots.add(slot); 
    }
  });

  /**
   * 4) Decide if a sensor option should be disabled in the dropdown.
   *    If it shares a slot with something else that’s already chosen, we disable it.
   */
  const isOptionDisabled = (option) => {
    // If this sensor doesn't have a numeric index, we won't disable it. 
    // e.g. “Temperature” doesn’t conflict with “Humidity,” etc.
    const slot = getSensorSlot(option);
    if (!slot) return false;

    // If that slot is already in use, and the user hasn't chosen exactly this same sensor,
    // we disable it.
    return occupiedSlots.has(slot) && !sensorsForCurrentInstance.includes(option);
  };

  const handleSaveInstance = () => {
    if (!selectedSensor) return;
    addSensor(selectedNode, selectedSensor);
    // You can reset the select after saving if you want:
    setSelectedSensor("");
  };

  const handleDeleteSingle = (sensor) => {
    removeSensor(selectedInstance, sensor);
  };

  const handleClearAll = () => {
    clearSensors(selectedInstance);
  };

  return (
    <div className={styles.sensorContent}>
      <h2>Sensor Manager</h2>
      <div className={styles.sensorGrid}>
        <h3 className={styles.instanceConfigTitle}>Instance Configuration</h3>

        <div className={styles.formRow}>
          <div className={styles.leftColumn}>
            <label className={styles.sensorLabel}>Board Type:</label>
          </div>
          <div className={styles.rightColumn}>
            <select
              value={boardType}
              onChange={(e) => {
                setBoardType(e.target.value);
                setSelectedSensor("");
              }}
              className={styles.sensorDropdown}
            >
              <option value="GSMB">GSMB</option>
              <option value="HPCB">HPCB</option>
              <option value="NSCB">NSCB</option>
            </select>
          </div>
        </div>

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
                  disabled={isOptionDisabled(option)}
                >
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

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

        <div className={styles.buttonRow}>
          <button className={styles.saveButton} onClick={handleSaveInstance}>
            Save Instance
          </button>
        </div>

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
