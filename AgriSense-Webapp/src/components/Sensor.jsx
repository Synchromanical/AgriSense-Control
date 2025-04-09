// Sensor.jsx
import React, { useState, useContext, useEffect } from "react";
import { SensorContext } from "../SensorContext";
import styles from "../Sensor.module.css";

// 1) For clarity, we still group sensors by board type in one place:
const sensorOptionsByBoardType = {
  GSMB: ["Temperature", "Humidity", "Soil Moisture"],
  HPCB: [
    "Fan 1",
    "Fan 2",
    "Fan 3",
    "Light 1",
    "Light 2",
    "Light 3",
    "Humidifier 1",
    "Humidifier 2",
    "Humidifier 3",
  ],
  NSCB: ["Water Level", "Nutrient 1 Level", "Nutrient 2 Level"],
};

// 2) A helper that returns which board type a given sensor belongs to
function getBoardTypeForSensor(sensorName) {
  for (const [boardType, sensorList] of Object.entries(sensorOptionsByBoardType)) {
    if (sensorList.includes(sensorName)) {
      return boardType;
    }
  }
  return null;
}

// 3) Extract the slot number (1, 2, or 3) from sensors like "Fan 1", "Light 2", etc.
function getSensorSlot(sensorName) {
  const match = sensorName.match(/\b(\d)\b/);
  return match ? match[1] : null; // e.g. "1"
}

// 4) Map board type to "Node" number:
function getNodeNumberForBoard(boardType) {
  if (boardType === "GSMB") return 1;
  if (boardType === "HPCB") return 2;
  if (boardType === "NSCB") return 3;
  return 0;
}

const Sensor = () => {
  const { activeSensors, addSensor, removeSensor, clearSensors, selectedInstance } =
    useContext(SensorContext);

  const [selectedSensor, setSelectedSensor] = useState("");
  const [boardType, setBoardType] = useState("GSMB");
  const [selectedNode, setSelectedNode] = useState(selectedInstance);

  useEffect(() => {
    setSelectedNode(selectedInstance);
  }, [selectedInstance]);

  // Grab the sensors for the currently selected instance
  const sensorsForCurrentInstance = activeSensors[selectedInstance] || [];

  // Build an object of occupied slots per board, for the current instance
  const occupiedSlotsByBoard = {
    GSMB: new Set(),
    HPCB: new Set(),
    NSCB: new Set(),
  };

  sensorsForCurrentInstance.forEach((existingSensor) => {
    const existingBoardType = getBoardTypeForSensor(existingSensor);
    const slot = getSensorSlot(existingSensor);
    if (existingBoardType && slot) {
      occupiedSlotsByBoard[existingBoardType].add(slot);
    }
  });

  // Decide if a sensor option in the dropdown is disabled (due to slot conflicts)
  const isOptionDisabled = (option) => {
    const optBoardType = getBoardTypeForSensor(option);
    const slot = getSensorSlot(option);
    if (!optBoardType || !slot) {
      // e.g. "Temperature" has no numeric slot
      return false;
    }
    const alreadyChosen = sensorsForCurrentInstance.includes(option);
    return occupiedSlotsByBoard[optBoardType].has(slot) && !alreadyChosen;
  };

  // When user clicks "Save Instance"
  const handleSaveInstance = () => {
    if (!selectedSensor) return;
    addSensor(selectedNode, selectedSensor);
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

        {/* Board Type */}
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

        {/* Variable */}
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
                <option key={option} value={option} disabled={isOptionDisabled(option)}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Instance selector (was "Node:" => now "Instance:") */}
        <div className={styles.formRow}>
          <div className={styles.leftColumn}>
            <label className={styles.sensorLabel}>Instance:</label>
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

        {/* Active Variables (renamed from "Active Sensors") */}
        <h4 className={styles.automationHeading}>
          Active Variables (Instance {selectedInstance})
        </h4>
        {sensorsForCurrentInstance.length === 0 && <p>No active sensors yet.</p>}
        {sensorsForCurrentInstance.map((sensor, index) => {
          const board = getBoardTypeForSensor(sensor);
          const nodeNumber = getNodeNumberForBoard(board);
          return (
            <div key={index} className={styles.automationItemRow}>
              <div>
                <strong>{sensor}</strong> (Node {nodeNumber})
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
          );
        })}
        {sensorsForCurrentInstance.length > 0 && (
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
