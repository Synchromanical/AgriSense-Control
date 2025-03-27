import React, { useEffect, useState, useContext } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import styles from "../ControlPanel.module.css";
import { SensorContext } from "../SensorContext";

function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

function getTimestampString(date = new Date()) {
  const iso = date.toISOString();
  const [withoutMillis] = iso.split(".");
  return withoutMillis + "Z";
}

/*
  Mapping from sensor (normalized to lowercase with no spaces) to its associated collection and field.
  Note: "fan" is written to the "fanState" field.
*/
const sensorMapping = {
  temperature: { collection: "GSMB", field: "temperature" },
  humidity: { collection: "GSMB", field: "humidity" },
  soilmoisture: { collection: "GSMB", field: "soilMoisture" },
  light: { collection: "HPCB", field: "light" },
  lightstate: { collection: "HPCB", field: "lightState" },
  fanstate: { collection: "HPCB", field: "fanState" },
  waterlevel: { collection: "NSCB", field: "waterLevel" },
};

const ControlPanel = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];
  const [latestData, setLatestData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light: "",
    waterLevel: "",
    lightState: false,
    fanState: false,
    timestamp: null,
  });
  const [editedData, setEditedData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light: "",
    lightState: false,
    fanState: false,
  });
  // Automations state remains unchanged…
  const [automations, setAutomations] = useState([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState("");
  const [automationForm, setAutomationForm] = useState({
    name: "",
    type: "time-based",
    enabled: true,
    dateTime: "",
    repeatSchedule: "none",
    sensorField: "temperature",
    operator: ">",
    thresholdValue: "",
    action: "turnFanOn",
  });

  // Listen for sensor updates from appropriate collections based on active sensors.
  useEffect(() => {
    const collectionsNeeded = {};
    sensors.forEach((sensorName) => {
      const key = sensorName.toLowerCase().replace(/\s/g, "");
      if (sensorMapping[key]) {
        const colName = sensorMapping[key].collection;
        if (!collectionsNeeded[colName]) {
          collectionsNeeded[colName] = new Set();
        }
        collectionsNeeded[colName].add(sensorMapping[key].field);
        // For "Light", also listen for "lightState"
        if (key === "light") {
          collectionsNeeded[colName].add("lightState");
        }
      }
    });
    const unsubscribes = [];
    Object.entries(collectionsNeeded).forEach(([colName, fieldsSet]) => {
      const colRef = collection(db, colName);
      const q = query(colRef, orderBy("timestamp", "desc"), limit(1));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data();
          setLatestData((prev) => {
            const newData = { ...prev };
            fieldsSet.forEach((field) => {
              if (data[field] !== undefined) {
                newData[field] =
                  typeof data[field] === "boolean"
                    ? data[field]
                    : formatOneDecimal(data[field]);
              }
            });
            newData.timestamp = data.timestamp;
            return newData;
          });
          setEditedData((prev) => {
            const newData = { ...prev };
            fieldsSet.forEach((field) => {
              if (data[field] !== undefined) {
                newData[field] =
                  typeof data[field] === "boolean"
                    ? data[field]
                    : formatOneDecimal(data[field]);
              }
            });
            return newData;
          });
        }
      });
      unsubscribes.push(unsubscribe);
    });
    return () => unsubscribes.forEach((u) => u());
  }, [sensors]);

  /*
    Updated write function:
    – For each active board (based on sensors), create a full document that always includes all required fields.
    For GSMB: temperature, humidity, soilMoisture, boardType ("GSMB"), timestamp.
    For HPCB: light, lightState, fanState, boardType ("HPCB"), timestamp.
    For NSCB: waterLevel, boardType ("NSCB"), timestamp.
    Values are taken from updatedFields if provided; otherwise fallback to latestData or default.
  */
  async function createNewReading(updatedFields) {
    // Determine active boards based on active sensors.
    const activeBoards = new Set();
    sensors.forEach((sensorName) => {
      const key = sensorName.toLowerCase().replace(/\s/g, "");
      if (sensorMapping[key]) {
        activeBoards.add(sensorMapping[key].collection);
      }
    });
    const timestamp = getTimestampString();
    // Build a full document for each board.
    for (const board of activeBoards) {
      let docData = { boardType: board, timestamp };
      if (board === "GSMB") {
        docData.temperature =
          updatedFields.temperature !== undefined
            ? updatedFields.temperature
            : latestData.temperature !== "" ? latestData.temperature : 0;
        docData.humidity =
          updatedFields.humidity !== undefined
            ? updatedFields.humidity
            : latestData.humidity !== "" ? latestData.humidity : 0;
        docData.soilMoisture =
          updatedFields.soilMoisture !== undefined
            ? updatedFields.soilMoisture
            : latestData.soilMoisture !== "" ? latestData.soilMoisture : 0;
        docData.temperature = parseFloat(docData.temperature) || 0;
        docData.humidity = parseFloat(docData.humidity) || 0;
        docData.soilMoisture = parseFloat(docData.soilMoisture) || 0;
      } else if (board === "HPCB") {
        docData.light =
          updatedFields.light !== undefined
            ? updatedFields.light
            : latestData.light !== "" ? latestData.light : 0;
        docData.lightState =
          updatedFields.lightState !== undefined
            ? updatedFields.lightState
            : typeof latestData.lightState === "boolean" ? latestData.lightState : false;
        docData.fanState =
          updatedFields.fanState !== undefined
            ? updatedFields.fanState
            : typeof latestData.fanState === "boolean" ? latestData.fanState : false;
        docData.light = parseFloat(docData.light) || 0;
      } else if (board === "NSCB") {
        docData.waterLevel =
          updatedFields.waterLevel !== undefined
            ? updatedFields.waterLevel
            : latestData.waterLevel !== "" ? latestData.waterLevel : 0;
        docData.waterLevel = parseFloat(docData.waterLevel) || 0;
      }
      try {
        await addDoc(collection(db, board), docData);
      } catch (error) {
        console.error(`Error creating new reading in ${board}:`, error);
      }
    }
  }

  const handleKeyDown = (e) => {
    const allowedKeys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Backspace",
      "Tab",
      "Delete",
      "Enter",
      ".",
    ];
    const isNumberKey =
      (e.key >= "0" && e.key <= "9") || (e.keyCode >= 96 && e.keyCode <= 105);
    if (!allowedKeys.includes(e.key) && !isNumberKey) {
      e.preventDefault();
    }
  };

  const handleSetSensor = async (field) => {
    const newValue = editedData[field];
    await createNewReading({ [field]: newValue });
  };

  const handleSetAllSensors = async () => {
    const updateObj = {};
    if (editedData.temperature !== "") updateObj.temperature = editedData.temperature;
    if (editedData.humidity !== "") updateObj.humidity = editedData.humidity;
    if (editedData.soilMoisture !== "") updateObj.soilMoisture = editedData.soilMoisture;
    if (editedData.light !== "") updateObj.light = editedData.light;
    updateObj.lightState = editedData.lightState;
    updateObj.fanState = editedData.fanState;
    if (editedData.waterLevel !== undefined) updateObj.waterLevel = editedData.waterLevel;
    await createNewReading(updateObj);
  };

  const handleFillWater = async () => {
    await createNewReading({ waterLevel: 100 });
  };

  // Automation handlers remain unchanged…
  const handleAutomationFormChange = (field, value) => {
    setAutomationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateAutomation = async () => {
    try {
      const docRef = await addDoc(collection(db, "automations"), {
        ...automationForm,
        thresholdValue: automationForm.thresholdValue
          ? parseFloat(automationForm.thresholdValue)
          : "",
      });
      console.log("Created automation with ID:", docRef.id);
      setAutomationForm({
        name: "",
        type: "time-based",
        enabled: true,
        dateTime: "",
        repeatSchedule: "none",
        sensorField: "temperature",
        operator: ">",
        thresholdValue: "",
        action: "turnFanOn",
      });
      setSelectedAutomationId(docRef.id);
    } catch (error) {
      console.error("Error creating automation:", error);
    }
  };

  const handleSelectAutomation = (e) => {
    const id = e.target.value;
    setSelectedAutomationId(id);
    if (!id) {
      setAutomationForm({
        name: "",
        type: "time-based",
        enabled: true,
        dateTime: "",
        repeatSchedule: "none",
        sensorField: "temperature",
        operator: ">",
        thresholdValue: "",
        action: "turnFanOn",
      });
      return;
    }
    const found = automations.find((a) => a.id === id);
    if (found) {
      setAutomationForm({
        name: found.name ?? "",
        type: found.type ?? "time-based",
        enabled: typeof found.enabled === "boolean" ? found.enabled : true,
        dateTime: found.dateTime ?? "",
        repeatSchedule: found.repeatSchedule ?? "none",
        sensorField: found.sensorField ?? "temperature",
        operator: found.operator ?? ">",
        thresholdValue: found.thresholdValue?.toString() ?? "",
        action: found.action ?? "turnFanOn",
      });
    }
  };

  const handleUpdateAutomation = async () => {
    if (!selectedAutomationId) return;
    try {
      const docRef = doc(db, "automations", selectedAutomationId);
      await updateDoc(docRef, {
        ...automationForm,
        thresholdValue: automationForm.thresholdValue
          ? parseFloat(automationForm.thresholdValue)
          : "",
      });
      console.log("Updated automation:", selectedAutomationId);
    } catch (error) {
      console.error("Error updating automation:", error);
    }
  };

  const handleToggleEnabled = async (automationId, currentEnabled) => {
    try {
      const docRef = doc(db, "automations", automationId);
      await updateDoc(docRef, {
        enabled: !currentEnabled,
      });
    } catch (error) {
      console.error("Error toggling automation:", error);
    }
  };

  const handleClearAutomations = async () => {
    try {
      const snap = await import("firebase/firestore").then(({ getDocs }) =>
        getDocs(collection(db, "automations"))
      );
      for (const autoDoc of snap.docs) {
        await deleteDoc(doc(db, "automations", autoDoc.id));
      }
      setSelectedAutomationId("");
      setAutomationForm({
        name: "",
        type: "time-based",
        enabled: true,
        dateTime: "",
        repeatSchedule: "none",
        sensorField: "temperature",
        operator: ">",
        thresholdValue: "",
        action: "turnFanOn",
      });
    } catch (error) {
      console.error("Error clearing automations:", error);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedAutomationId) return;
    try {
      await deleteDoc(doc(db, "automations", selectedAutomationId));
      setSelectedAutomationId("");
      setAutomationForm({
        name: "",
        type: "time-based",
        enabled: true,
        dateTime: "",
        repeatSchedule: "none",
        sensorField: "temperature",
        operator: ">",
        thresholdValue: "",
        action: "turnFanOn",
      });
    } catch (error) {
      console.error("Error deleting automation:", error);
    }
  };

  return (
    <div className={styles.content}>
      <h2>Control Panel</h2>
      <div className={styles.controlPanelContainer}>
        <h3>Sensor Control</h3>
        {sensors.length === 0 ? (
          <p>Please select a sensor in the Sensor tab to control.</p>
        ) : (
          <div className={styles.controlPanelGrid}>
            {sensors.includes("Temperature") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Temperature:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="number" value={latestData.temperature} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>°C</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.temperature}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, temperature: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>°C</span>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("temperature")} className={styles.setButton}>
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Humidity") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Humidity:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="number" value={latestData.humidity} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>%</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.humidity}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, humidity: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>%</span>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("humidity")} className={styles.setButton}>
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Soil Moisture") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Soil Moisture:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="number" value={latestData.soilMoisture} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>%</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.soilMoisture}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, soilMoisture: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>%</span>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("soilMoisture")} className={styles.setButton}>
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Light") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Light:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="number" value={latestData.light} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.light}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, light: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("light")} className={styles.setButton}>
                    Set
                  </button>
                </div>
                <div className={styles.rowLabel}>
                  <strong>Light State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="text" value={latestData.lightState ? "On" : "Off"} readOnly className={styles.sensorInput} />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="lightState"
                      value="true"
                      checked={editedData.lightState === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, lightState: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="lightState"
                      value="false"
                      checked={editedData.lightState === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, lightState: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("lightState")} className={styles.setButton}>
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Water Level") && (
            <>
              <div className={styles.rowLabel}>
                <strong>Water Level:</strong>
              </div>
              <div className={styles.rowLatest}>
                <input
                  type="number"
                  value={latestData.waterLevel}
                  readOnly
                  className={styles.sensorInput}
                />
                <span className={styles.unit}>%</span>
              </div>
              <div className={styles.rowButton}>
                <button onClick={handleFillWater} className={styles.setButton}>
                  Fill Water
                </button>
              </div>
              {/* Empty cell for the Set column */}
              <div className={styles.rowSet}></div>
            </>
          )}

           {sensors.includes("Fan") && (
            <>
              <div className={styles.rowLabel}>
                <strong>Fan State:</strong>
              </div>
              <div className={styles.rowLatest}>
                <input
                  type="text"
                  value={latestData.fanState ? "On" : "Off"}
                  readOnly
                  className={styles.sensorInput}
                />
              </div>
              <div className={styles.rowButton}>
                <label className={styles.automationRadioLabel}>
                  <input
                    type="radio"
                    name="fanState"
                    value="true"
                    checked={editedData.fanState === true}
                    onChange={() =>
                      setEditedData((prev) => ({ ...prev, fanState: true }))
                    }
                  />
                  On
                </label>
                <label className={styles.automationRadioLabel}>
                  <input
                    type="radio"
                    name="fanState"
                    value="false"
                    checked={editedData.fanState === false}
                    onChange={() =>
                      setEditedData((prev) => ({ ...prev, fanState: false }))
                    }
                  />
                  Off
                </label>
              </div>
              <div className={styles.rowSet}>
                <button
                  onClick={() => handleSetSensor("fanState")}
                  className={styles.setButton}
                >
                  Set
                </button>
              </div>
            </>
          )}
          </div>
        )}
      </div>
      <div className={styles.automationContainer}>
        <h3>Automations</h3>
        <p className={styles.automationPurpose}>
          <strong>Purpose of Automation</strong>
          <br />
          Automations let you perform actions (e.g., turn fan on/off, fill water) automatically based on specific conditions.
          <br />
          Time-based (scheduled) or Threshold-based (react to sensor data).
        </p>
        <div className={styles.automationTopSelect}>
          <label className={styles.automationSelectLabel}>Saved Automations:</label>
          <select value={selectedAutomationId} onChange={handleSelectAutomation} className={styles.automationDropdown}>
            <option value="">-- Create New --</option>
            {automations.map((auto) => {
              const display = `${auto.name} (${auto.type})`;
              return (
                <option key={auto.id} value={auto.id}>
                  {display}
                </option>
              );
            })}
          </select>
        </div>
        <div className={styles.automationGrid4col}>
          <div className={styles.automationLeft}>
            <label className={styles.automationStep}>Name</label>
            <input type="text" className={styles.automationNameInput} value={automationForm.name} onChange={(e) => handleAutomationFormChange("name", e.target.value)} />
          </div>
          <div className={styles.automationMiddle}>
            <label className={styles.automationStep}>Type</label>
            <div className={styles.automationSelectBlock}>
              <select value={automationForm.type} onChange={(e) => handleAutomationFormChange("type", e.target.value)} className={styles.automationDropdown}>
                <option value="time-based">Time-Based</option>
                <option value="threshold-based">Threshold-Based</option>
              </select>
            </div>
          </div>
          <div className={styles.automationRight}>
            {automationForm.type === "time-based" ? (
              <>
                <label className={styles.automationLabelMargin}>Date/Time</label>
                <input type="datetime-local" className={styles.automationDatetimeInput} value={automationForm.dateTime} onChange={(e) => handleAutomationFormChange("dateTime", e.target.value)} />
              </>
            ) : (
              <>
                <label className={styles.automationLabelMargin}>Sensor Field</label>
                <select className={`${styles.automationDropdown} ${styles.automationSelectMargin}`} value={automationForm.sensorField} onChange={(e) => handleAutomationFormChange("sensorField", e.target.value)}>
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                  <option value="soilMoisture">Soil Moisture</option>
                  <option value="light">Light</option>
                  <option value="waterLevel">Water Level</option>
                </select>
                <label className={styles.automationLabelMargin}>Operator</label>
                <select className={`${styles.automationDropdown} ${styles.automationSelectMargin}`} value={automationForm.operator} onChange={(e) => handleAutomationFormChange("operator", e.target.value)}>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="=">=</option>
                </select>
                <label className={styles.automationLabelMargin}>Threshold</label>
                <input type="number" className={`${styles.automationNameInput} ${styles.automationSelectMargin}`} value={automationForm.thresholdValue} onChange={(e) => handleAutomationFormChange("thresholdValue", e.target.value)} />
              </>
            )}
          </div>
          <div className={styles.automationSaved}>
            <label>Action</label>
            <select className={styles.automationDropdown} value={automationForm.action} onChange={(e) => handleAutomationFormChange("action", e.target.value)}>
              <option value="turnFanOn">Turn Fan On</option>
              <option value="turnFanOff">Turn Fan Off</option>
              <option value="fillWater">Fill Water</option>
              <option value="sendAlert">Send Alert</option>
            </select>
            <div className={styles.automationActionButtonsContainer}>
              <button onClick={handleCreateAutomation} className={`${styles.setButton} ${styles.automationSpaceRight}`}>
                Create
              </button>
              <button onClick={handleUpdateAutomation} disabled={!selectedAutomationId} className={`${styles.setButton} ${styles.automationSpaceRight}`}>
                Update
              </button>
              <button onClick={handleDeleteSelected} disabled={!selectedAutomationId} className={styles.setButton}>
                Delete
              </button>
            </div>
          </div>
          <div className={styles.automationLeftEmpty}></div>
          <div className={styles.automationMiddleEnabled}>
            <label className={styles.automationEnabledLabel}>Enabled?</label>
            <input type="checkbox" checked={automationForm.enabled} onChange={(e) => handleAutomationFormChange("enabled", e.target.checked)} />
          </div>
          <div className={styles.automationRightRepeat}>
            {automationForm.type === "time-based" && (
              <>
                <label className={styles.automationRepeatLabel}>Repeat</label>
                <select className={styles.automationDropdownTime} value={automationForm.repeatSchedule} onChange={(e) => handleAutomationFormChange("repeatSchedule", e.target.value)}>
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </>
            )}
          </div>
          <div className={styles.automationSavedEmpty}></div>
        </div>
        <div className={styles.automationExistingList}>
          <h4>Existing Automations</h4>
          {automations.length === 0 && <p>No automations found.</p>}
          {automations.map((auto) => (
            <div key={auto.id} className={styles.automationItemRow}>
              <div>
                <strong>{auto.name}</strong> ({auto.type}) – {auto.enabled ? "Enabled" : "Disabled"}
              </div>
              <div>
                <button onClick={() => handleToggleEnabled(auto.id, auto.enabled)} className={`${styles.setButton} ${styles.automationToggleButton}`}>
                  Toggle
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={handleClearAutomations} className={`${styles.setButton} ${styles.automationClearButton}`}>
          Clear All Automations
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
