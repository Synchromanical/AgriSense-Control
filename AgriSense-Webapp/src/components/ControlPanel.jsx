// src/components/ControlPanel.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Utility to format numeric values to 1 decimal place
function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

// Returns a string-based timestamp like "2025-02-02T12:30:00Z"
function getTimestampString(date = new Date()) {
  const iso = date.toISOString();
  const [withoutMillis] = iso.split(".");
  return withoutMillis + "Z";
}

const ControlPanel = () => {
  // -----------------------
  // SENSOR DATA STATES
  // -----------------------
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

  // "Set To" (edited) states
  const [editedData, setEditedData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light: "",
    lightState: false,
    fanState: false,
  });

  // -----------------------
  // AUTOMATIONS STATES
  // -----------------------
  const [automations, setAutomations] = useState([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState("");

  // Form data for creating/updating an automation
  const [automationForm, setAutomationForm] = useState({
    name: "",
    type: "time-based",       // "time-based" or "threshold-based"
    enabled: true,
    dateTime: "",
    repeatSchedule: "none",   // e.g. "none", "daily", "weekly"
    sensorField: "temperature", // For threshold-based
    operator: ">",            // For threshold-based: "<", ">", "="
    thresholdValue: "",
    action: "turnFanOn",      // e.g. "fillWater", "turnFanOn", etc.
  });

  // ----------------------------------------------------------------
  // 1) REAL-TIME LISTENER FOR LATEST SENSOR DATA (limit 1, desc)
  // ----------------------------------------------------------------
  useEffect(() => {
    const sensorCollection = collection(db, "sensorData");
    const q = query(sensorCollection, orderBy("timestamp", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        // Populate latestData
        setLatestData({
          temperature: formatOneDecimal(data.temperature),
          humidity: formatOneDecimal(data.humidity),
          soilMoisture: formatOneDecimal(data.soilMoisture),
          light: formatOneDecimal(data.light),
          waterLevel: data.waterLevel ?? "",
          lightState: data.lightState ?? false,
          fanState: data.fanState ?? false,
          timestamp: data.timestamp,
        });

        // Initialize editedData with same values
        setEditedData({
          temperature: formatOneDecimal(data.temperature),
          humidity: formatOneDecimal(data.humidity),
          soilMoisture: formatOneDecimal(data.soilMoisture),
          light: formatOneDecimal(data.light),
          lightState: data.lightState ?? false,
          fanState: data.fanState ?? false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // ----------------------------------------------------------------
  // 2) REAL-TIME LISTENER FOR AUTOMATIONS
  // ----------------------------------------------------------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "automations"), (snapshot) => {
      const fetched = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      setAutomations(fetched);
    });
    return () => unsub();
  }, []);

  // ----------------------------------------------------------------
  // 3) CREATE A NEW READING DOC (merging updated fields)
  // ----------------------------------------------------------------
  async function createNewReading(updatedFields) {
    const mergedData = {
      temperature:
        parseFloat(updatedFields.temperature ?? latestData.temperature) || 0,
      humidity:
        parseFloat(updatedFields.humidity ?? latestData.humidity) || 0,
      soilMoisture:
        parseFloat(updatedFields.soilMoisture ?? latestData.soilMoisture) || 0,
      light: parseFloat(updatedFields.light ?? latestData.light) || 0,
      waterLevel:
        parseFloat(updatedFields.waterLevel ?? latestData.waterLevel) || 0,
      lightState:
        typeof updatedFields.lightState === "boolean"
          ? updatedFields.lightState
          : latestData.lightState,
      fanState:
        typeof updatedFields.fanState === "boolean"
          ? updatedFields.fanState
          : latestData.fanState,
      timestamp: getTimestampString()
    };

    try {
      await addDoc(collection(db, "sensorData"), mergedData);
    } catch (error) {
      console.error("Error creating new reading doc:", error);
    }
  }

  // ----------------------------------------------------------------
  // 4) HANDLERS FOR “SET” & “SET ALL”
  // ----------------------------------------------------------------
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
    await createNewReading({
      temperature: editedData.temperature,
      humidity: editedData.humidity,
      soilMoisture: editedData.soilMoisture,
      light: editedData.light,
      lightState: editedData.lightState,
      fanState: editedData.fanState,
    });
  };

  const handleFillWater = async () => {
    await createNewReading({ waterLevel: 100 });
  };

  // ----------------------------------------------------------------
  // 5) AUTOMATIONS CRUD
  // ----------------------------------------------------------------
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
      // Reset form
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
      // Reset form if no selection
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

  // ----------------------------------------------------------------
  // 6) RENDER
  // ----------------------------------------------------------------
  return (
    <div className="content">
      <h2>Control Panel</h2>

      {/* SENSOR CONTROL SECTION */}
      <div className="control-panel-container">
        <h3>Sensor Control</h3>
        <div className="control-panel-grid">
          {/* Header row */}
          <div></div>
          <div className="heading-col">Current</div>
          <div className="heading-col">Set To</div>
          <div></div>

          {/* Temperature row */}
          <div className="row-label">
            <strong>Temperature:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.temperature}
              readOnly
              className="sensor-input"
            />
            <span className="unit">°C</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.temperature}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, temperature: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">°C</span>
          </div>
          <div className="row-set">
            <button onClick={() => handleSetSensor("temperature")} className="set-button">
              Set
            </button>
          </div>

          {/* Humidity row */}
          <div className="row-label">
            <strong>Humidity:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.humidity}
              readOnly
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.humidity}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, humidity: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-set">
            <button onClick={() => handleSetSensor("humidity")} className="set-button">
              Set
            </button>
          </div>

          {/* Soil Moisture row */}
          <div className="row-label">
            <strong>Soil Moisture:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.soilMoisture}
              readOnly
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.soilMoisture}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, soilMoisture: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-set">
            <button onClick={() => handleSetSensor("soilMoisture")} className="set-button">
              Set
            </button>
          </div>

          {/* Light row */}
          <div className="row-label">
            <strong>Light:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.light}
              readOnly
              className="sensor-input"
            />
            <span className="unit">lux</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.light}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, light: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">lux</span>
          </div>
          <div className="row-set">
            <button onClick={() => handleSetSensor("light")} className="set-button">
              Set
            </button>
          </div>

          {/* Light State row (boolean) */}
          <div className="row-label">
            <strong>Light State:</strong>
          </div>
          <div className="row-latest">
            <input
              type="text"
              value={latestData.lightState ? "On" : "Off"}
              readOnly
              className="sensor-input"
            />
          </div>
          <div className="row-edited">
            <label className="automation-radio-label">
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
            <label className="automation-radio-label">
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
          <div className="row-set">
            <button onClick={() => handleSetSensor("lightState")} className="set-button">
              Set
            </button>
          </div>

          {/* Water Level row */}
          <div className="row-label">
            <strong>Water Level:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.waterLevel}
              readOnly
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-edited">
            <button onClick={handleFillWater} className="set-button">
              Fill Water
            </button>
          </div>
          <div></div>

          {/* Fan row (boolean) */}
          <div className="row-label">
            <strong>Fan:</strong>
          </div>
          <div className="row-latest">
            <input
              type="text"
              value={latestData.fanState ? "On" : "Off"}
              readOnly
              className="sensor-input"
            />
          </div>
          <div className="row-edited">
            <label className="automation-radio-label">
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
            <label className="automation-radio-label">
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
          <div className="row-set">
            <button onClick={() => handleSetSensor("fanState")} className="set-button">
              Set
            </button>
          </div>

          {/* "Set All" button at the very bottom */}
          <div></div>
          <div></div>
          <div></div>
          <div className="row-set">
            <button onClick={handleSetAllSensors} className="set-button">
              Set All
            </button>
          </div>
        </div>
      </div>

      {/* AUTOMATION SECTION */}
      <div className="automation-container">
        <h3>Automations</h3>
        <p className="automation-purpose">
          <strong>Purpose of Automation</strong><br />
          Automations let you perform actions (e.g., turn fan on/off, fill water) automatically based on specific conditions. <br />
          Time-based (scheduled) or Threshold-based (react to sensor data).
        </p>

        {/* Selection for existing automations */}
        <div className="automation-top-select">
          <label className="automation-select-label">Saved Automations:</label>
          <select
            value={selectedAutomationId}
            onChange={handleSelectAutomation}
            className="automation-dropdown"
          >
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

        {/* -----------------------
            AUTOMATION GRID 
            2 ROWS, 4 COLS:
            Row 1: (Col1: Name, Col2: Type, Col3: DateTime/Threshold, Col4: Action+Buttons)
            Row 2: (Col1: empty, Col2: Enabled, Col3: Repeat, Col4: empty)
           ----------------------- */}
        <div className="automation-grid-4col">
          {/* Row 1, Col 1: Name */}
          <div className="automation-left">
            <label className="automation-step">Name</label>
            <input
              type="text"
              className="automation-name-input"
              value={automationForm.name}
              onChange={(e) => handleAutomationFormChange("name", e.target.value)}
            />
          </div>

          {/* Row 1, Col 2: Type */}
          <div className="automation-middle">
            <label className="automation-step">Type</label>
            <div className="automation-select-block">
              <select
                value={automationForm.type}
                onChange={(e) => handleAutomationFormChange("type", e.target.value)}
                className="automation-dropdown"
              >
                <option value="time-based">Time-Based</option>
                <option value="threshold-based">Threshold-Based</option>
              </select>
            </div>
          </div>

          {/* Row 1, Col 3: If time-based => DateTime; If threshold-based => threshold fields */}
          <div className="automation-right">
            {automationForm.type === "time-based" ? (
              <>
                <label className="automation-label-margin">Date/Time</label>
                <input
                  type="datetime-local"
                  className="automation-datetime-input"
                  value={automationForm.dateTime}
                  onChange={(e) => handleAutomationFormChange("dateTime", e.target.value)}
                />
              </>
            ) : (
              <>
                <label className="automation-label-margin">Sensor Field</label>
                <select
                  className="automation-dropdown automation-select-margin"
                  value={automationForm.sensorField}
                  onChange={(e) =>
                    handleAutomationFormChange("sensorField", e.target.value)
                  }
                >
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                  <option value="soilMoisture">Soil Moisture</option>
                  <option value="light">Light</option>
                  <option value="waterLevel">Water Level</option>
                </select>

                <label className="automation-label-margin">Operator</label>
                <select
                  className="automation-dropdown automation-select-margin"
                  value={automationForm.operator}
                  onChange={(e) =>
                    handleAutomationFormChange("operator", e.target.value)
                  }
                >
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="=">=</option>
                </select>

                <label className="automation-label-margin">Threshold</label>
                <input
                  type="number"
                  className="automation-name-input automation-select-margin"
                  value={automationForm.thresholdValue}
                  onChange={(e) => handleAutomationFormChange("thresholdValue", e.target.value)}
                />
              </>
            )}
          </div>

          {/* Row 1, Col 4: Action + Buttons */}
          <div className="automation-saved">
            <label>Action</label>
            <select
              className="automation-dropdown"
              value={automationForm.action}
              onChange={(e) => handleAutomationFormChange("action", e.target.value)}
            >
              <option value="turnFanOn">Turn Fan On</option>
              <option value="turnFanOff">Turn Fan Off</option>
              <option value="fillWater">Fill Water</option>
              <option value="sendAlert">Send Alert</option>
            </select>

            <div className="automation-action-buttons-container">
              <button
                onClick={handleCreateAutomation}
                className="set-button automation-space-right"
              >
                Create
              </button>
              <button
                onClick={handleUpdateAutomation}
                disabled={!selectedAutomationId}
                className="set-button automation-space-right"
              >
                Update
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={!selectedAutomationId}
                className="set-button"
              >
                Delete
              </button>
            </div>
          </div>

          {/* 2nd row, Col 1: empty */}
          <div className="automation-left-empty"></div>

          {/* 2nd row, Col 2: Enabled */}
          <div className="automation-middle-enabled">
            <label className="automation-enabled-label">Enabled?</label>
            <input
              type="checkbox"
              checked={automationForm.enabled}
              onChange={(e) => handleAutomationFormChange("enabled", e.target.checked)}
            />
          </div>

          {/* 2nd row, Col 3: Repeat (only if time-based) */}
          <div className="automation-right-repeat">
            {automationForm.type === "time-based" && (
              <>
                <label className="automation-repeat-label">Repeat</label>
                <select
                  className="automation-dropdown-time"
                  value={automationForm.repeatSchedule}
                  onChange={(e) =>
                    handleAutomationFormChange("repeatSchedule", e.target.value)
                  }
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </>
            )}
          </div>

          {/* 2nd row, Col 4: empty */}
          <div className="automation-saved-empty"></div>
        </div>

        {/* List of automations with quick toggle */}
        <div className="automation-existing-list">
          <h4>Existing Automations</h4>
          {automations.length === 0 && <p>No automations found.</p>}
          {automations.map((auto) => (
            <div key={auto.id} className="automation-item-row">
              <div>
                <strong>{auto.name}</strong> ({auto.type}) –{" "}
                {auto.enabled ? "Enabled" : "Disabled"}
              </div>
              <div>
                <button
                  onClick={() => handleToggleEnabled(auto.id, auto.enabled)}
                  className="set-button automation-toggle-button"
                >
                  Toggle
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Clear all automations button */}
        <button
          onClick={handleClearAutomations}
          className="set-button automation-clear-button"
        >
          Clear All Automations
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
