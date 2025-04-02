// ControlPanel.jsx
import React, { useState, useContext } from "react";
import styles from "../ControlPanel.module.css";
import { SensorContext } from "../SensorContext";
import { useDataContext } from "../DataContext";

/**
 * A mapping from user-facing sensor names to their internal fields, display labels, units,
 * and whether they are boolean toggles (checkbox) or numeric fields.
 * 
 * ADDED: "Nutrient 1 Level" and "Nutrient 2 Level"
 */
const sensorMap = {
  "Temperature":     { field: "temperature",     label: "Temperature",     unit: "°C",    isBoolean: false },
  "Humidity":        { field: "humidity",        label: "Humidity",        unit: "%",     isBoolean: false },
  "Soil Moisture":   { field: "soilMoisture",    label: "Soil Moisture",   unit: "%",     isBoolean: false },
  "Water Level":     { field: "waterLevel",      label: "Water Level",     unit: "%",     isBoolean: false },

  // Fans (boolean on/off)
  "Fan 1":           { field: "fan1State",       label: "Fan 1 State",     isBoolean: true },
  "Fan 2":           { field: "fan2State",       label: "Fan 2 State",     isBoolean: true },
  "Fan 3":           { field: "fan3State",       label: "Fan 3 State",     isBoolean: true },

  // Lights (boolean on/off)
  "Light 1":         { field: "light1State",     label: "Light 1 State",   isBoolean: true },
  "Light 2":         { field: "light2State",     label: "Light 2 State",   isBoolean: true },
  "Light 3":         { field: "light3State",     label: "Light 3 State",   isBoolean: true },

  // Humidifiers (boolean on/off)
  "Humidifier 1":    { field: "humidifier1State", label: "Humidifier 1",  isBoolean: true },
  "Humidifier 2":    { field: "humidifier2State", label: "Humidifier 2",  isBoolean: true },
  "Humidifier 3":    { field: "humidifier3State", label: "Humidifier 3",  isBoolean: true },

  // Nutrients (numeric)
  "Nutrient 1 Level": { field: "nutrient1", label: "Nutrient 1 Level", unit: "%", isBoolean: false },
  "Nutrient 2 Level": { field: "nutrient2", label: "Nutrient 2 Level", unit: "%", isBoolean: false },
};

function ControlPanel() {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const {
    dataState,
    createNewReading,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    clearAllAutomations,
  } = useDataContext();

  // The sensors for this instance
  const sensors = activeSensors[selectedInstance] || [];

  // "Latest" readings from Firestore
  const latestData = dataState.latest;

  // Local state for editing each field
  const [editedData, setEditedData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    waterLevel: "",
    fan1State: false,
    fan2State: false,
    fan3State: false,
    light1State: false,
    light2State: false,
    light3State: false,
    humidifier1State: false,
    humidifier2State: false,
    humidifier3State: false,
    nutrient1: "",
    nutrient2: "",
  });

  // Restrict numeric input
  const handleKeyDown = (e) => {
    const allowed = [
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "Backspace", "Tab", "Delete", "Enter", ".",
    ];
    const isNumberKey = /[0-9]/.test(e.key);
    if (!allowed.includes(e.key) && !isNumberKey) {
      e.preventDefault();
    }
  };

  // Sets a single field
  const handleSetSensor = async (field) => {
    await createNewReading({ [field]: editedData[field] }, sensors);
  };

  // "Set All" updates everything at once
  const handleSetAllSensors = async () => {
    await createNewReading({ ...editedData }, sensors);
  };

  // Example quick fill for Water
  const handleFillWater = async () => {
    await createNewReading({ waterLevel: 100 }, sensors);
  };

  // ─────────────────────────────────────────────────────────────
  // AUTOMATION STUFF
  // ─────────────────────────────────────────────────────────────
  const [selectedAutomationId, setSelectedAutomationId] = useState("");
  const [automationBoardType, setAutomationBoardType] = useState("NSCB");
  const [automationForm, setAutomationForm] = useState({
    name: "",
    type: "time-based",
    enabled: true,
    dateTime: "",
    sensorField: "temperature",
    operator: ">",
    thresholdValue: "",
    action: "addWater",
    timeLength: "",
    timeUnit: "Second",
  });

  const automations = dataState.automations;

  const handleCreateAutomation = async () => {
    const payload = {
      ...automationForm,
      boardType: automationBoardType,
    };
    const newId = await createAutomation(payload);
    if (newId) {
      setSelectedAutomationId(newId);
    }
  };

  const handleSelectAutomation = (e) => {
    const autoId = e.target.value;
    setSelectedAutomationId(autoId);
    if (!autoId) {
      // “Create new” mode
      setAutomationForm({
        name: "",
        type: "time-based",
        enabled: true,
        dateTime: "",
        sensorField: "temperature",
        operator: ">",
        thresholdValue: "",
        action: "addWater",
        timeLength: "",
        timeUnit: "Second",
      });
      return;
    }
    // If an existing automation is selected, load it
    const autoObj = automations.find((a) => a.id === autoId);
    if (autoObj) {
      setAutomationBoardType(autoObj.boardType || "NSCB");
      setAutomationForm({
        name: autoObj.name || "",
        type: autoObj.type || "time-based",
        enabled: autoObj.enabled ?? true,
        dateTime: autoObj.dateTime || "",
        sensorField: autoObj.sensorField || "temperature",
        operator: autoObj.operator || ">",
        thresholdValue: autoObj.thresholdValue || "",
        action: autoObj.action || "addWater",
        timeLength: autoObj.timeLength || "",
        timeUnit: autoObj.timeUnit || "Second",
      });
    }
  };

  const handleUpdateAutomation = async () => {
    if (!selectedAutomationId) return;
    const payload = {
      ...automationForm,
      boardType: automationBoardType,
    };
    await updateAutomation(selectedAutomationId, payload);
  };

  const handleDeleteSelected = async () => {
    if (!selectedAutomationId) return;
    await deleteAutomation(selectedAutomationId);
    setSelectedAutomationId("");
    setAutomationForm({
      name: "",
      type: "time-based",
      enabled: true,
      dateTime: "",
      sensorField: "temperature",
      operator: ">",
      thresholdValue: "",
      action: "addWater",
      timeLength: "",
      timeUnit: "Second",
    });
  };

  const handleToggleEnabled = async (autoId, curVal) => {
    await updateAutomation(autoId, { enabled: !curVal });
  };

  const clearAllAutomationsHandler = async () => {
    await clearAllAutomations();
  };

  function computeAutomationLabel(auto) {
    return `${auto.name} (${auto.type})`;
  }

  return (
    <div className={styles.content}>
      <h2>Control Panel</h2>

      {/* SENSORS */}
      <div className={styles.controlPanelContainer}>
        <h3>Sensor Control</h3>

        {sensors.length === 0 ? (
          <p>Please select a sensor in the Sensor tab to control.</p>
        ) : (
          <div className={styles.controlPanelGrid}>
            {sensors.map((sensorName) => {
              if (!sensorMap[sensorName]) return null;
              const { field, label, unit, isBoolean } = sensorMap[sensorName];

              // Latest value
              let latestVal = latestData[field];
              if (typeof latestVal === "undefined" || latestVal === null) {
                latestVal = isBoolean ? false : "";
              }

              // Local edited value
              let editedVal = editedData[field];

              return (
                <React.Fragment key={sensorName}>
                  <div className={styles.rowLabel}>
                    <strong>{label}:</strong>
                  </div>

                  {/* Latest reading */}
                  <div className={styles.rowLatest}>
                    {isBoolean ? (
                      <input
                        type="text"
                        readOnly
                        className={styles.sensorInput}
                        value={latestVal ? "On" : "Off"}
                      />
                    ) : (
                      <input
                        type="number"
                        readOnly
                        className={styles.sensorInput}
                        value={latestVal}
                      />
                    )}
                    {unit && !isBoolean && (
                      <span className={styles.unit}>{unit}</span>
                    )}
                  </div>

                  {/* Edited field */}
                  <div className={styles.rowEdited}>
                    {isBoolean ? (
                      <label style={{ display: "flex", alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={!!editedVal}
                          onChange={(e) =>
                            setEditedData((prev) => ({
                              ...prev,
                              [field]: e.target.checked,
                            }))
                          }
                        />
                        <span style={{ marginLeft: "6px" }}>
                          {editedVal ? "On" : "Off"}
                        </span>
                      </label>
                    ) : (
                      <input
                        type="number"
                        value={editedVal}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        onKeyDown={handleKeyDown}
                        className={styles.sensorInput}
                      />
                    )}
                    {unit && !isBoolean && (
                      <span className={styles.unit}>{unit}</span>
                    )}
                  </div>

                  {/* Single Set button */}
                  <div className={styles.rowSet}>
                    <button
                      onClick={() => handleSetSensor(field)}
                      className={styles.setButton}
                    >
                      Set
                    </button>
                  </div>

                  {/* Auto fill if water */}
                  {sensorName === "Water Level" && (
                    <>
                      <div className={styles.rowLabel}>
                        <strong>Auto Fill:</strong>
                      </div>
                      <div className={styles.rowButton}>
                        <button
                          onClick={handleFillWater}
                          className={styles.setButton}
                        >
                          Fill to 100%
                        </button>
                      </div>
                      <div />
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {sensors.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <button onClick={handleSetAllSensors} className={styles.setButton}>
              Set All
            </button>
          </div>
        )}
      </div>

      {/* AUTOMATIONS */}
      <div className={styles.automationContainer}>
        <h3>Automations</h3>
        <p className={styles.automationPurpose}>
          <strong>Purpose of Automation</strong>
          <br />
          Automations let you perform actions automatically based on conditions.
        </p>

        <div className={styles.automationTopSelect}>
          <label className={styles.automationSelectLabel}>Saved Automations:</label>
          <select
            value={selectedAutomationId}
            onChange={handleSelectAutomation}
            className={styles.automationDropdown}
          >
            <option value="">-- Create New --</option>
            {automations.map((auto) => (
              <option key={auto.id} value={auto.id}>
                {computeAutomationLabel(auto)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.automationBoardTypeContainer}>
          <label className={styles.automationSelectLabel}>Board Type:</label>
          <select
            value={automationBoardType}
            onChange={(e) => setAutomationBoardType(e.target.value)}
            className={styles.automationDropdown}
          >
            <option value="NSCB">NSCB</option>
            <option value="HPCB">HPCB</option>
            <option value="GSMB">GSMB</option>
          </select>
        </div>

        {/* Example time-based vs threshold-based form inputs, adapt as needed */}
        {/* Show/hide fields depending on automationForm.type, etc. */}
        <div style={{ marginTop: "10px" }}>
          <label>Automation Name:</label>
          <input
            type="text"
            value={automationForm.name}
            onChange={(e) =>
              setAutomationForm((prev) => ({ ...prev, name: e.target.value }))
            }
            className={styles.automationNameInput}
          />
        </div>

        <div style={{ marginTop: "10px" }}>
          <label>Automation Type:</label>
          <select
            value={automationForm.type}
            onChange={(e) =>
              setAutomationForm((prev) => ({ ...prev, type: e.target.value }))
            }
            className={styles.automationDropdown}
          >
            <option value="time-based">Time-based</option>
            <option value="threshold-based">Threshold-based</option>
          </select>
        </div>

        {/* If time-based, show dateTime field */}
        {automationForm.type === "time-based" && (
          <div style={{ marginTop: "10px" }}>
            <label>Trigger Date/Time:</label>
            <input
              type="datetime-local"
              value={automationForm.dateTime}
              onChange={(e) =>
                setAutomationForm((prev) => ({
                  ...prev,
                  dateTime: e.target.value,
                }))
              }
              className={styles.automationDatetimeInput}
            />
          </div>
        )}

        {/* If threshold-based, show sensorField/operator/thresholdValue */}
        {automationForm.type === "threshold-based" && (
          <div style={{ marginTop: "10px" }}>
            <label>Sensor Field:</label>
            <select
              value={automationForm.sensorField}
              onChange={(e) =>
                setAutomationForm((prev) => ({
                  ...prev,
                  sensorField: e.target.value,
                }))
              }
              className={styles.automationDropdown}
            >
              <option value="temperature">Temperature</option>
              <option value="humidity">Humidity</option>
              <option value="soilMoisture">Soil Moisture</option>
              <option value="waterLevel">Water Level</option>
              <option value="nutrient1">Nutrient 1</option>
              <option value="nutrient2">Nutrient 2</option>
            </select>

            <div style={{ marginTop: "10px" }}>
              <label>Operator:</label>
              <select
                value={automationForm.operator}
                onChange={(e) =>
                  setAutomationForm((prev) => ({
                    ...prev,
                    operator: e.target.value,
                  }))
                }
                className={styles.automationDropdown}
              >
                <option value=">"> &gt; </option>
                <option value="<"> &lt; </option>
                <option value="="> = </option>
              </select>
            </div>

            <div style={{ marginTop: "10px" }}>
              <label>Threshold Value:</label>
              <input
                type="number"
                value={automationForm.thresholdValue}
                onChange={(e) =>
                  setAutomationForm((prev) => ({
                    ...prev,
                    thresholdValue: e.target.value,
                  }))
                }
                className={styles.automationDatetimeInput}
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: "10px" }}>
          <label>Action:</label>
          <select
            value={automationForm.action}
            onChange={(e) =>
              setAutomationForm((prev) => ({
                ...prev,
                action: e.target.value,
              }))
            }
            className={styles.automationDropdown}
          >
            <option value="addWater">Add Water</option>
            <option value="drainWater">Drain Water</option>
            <option value="addNutrients">Add Nutrients</option>
            <option value="turnOnLights">Turn On Lights</option>
            <option value="turnOffLights">Turn Off Lights</option>
            {/* etc. */}
          </select>
        </div>

        <div style={{ marginTop: "10px" }}>
          <label>Enabled:</label>
          <input
            type="checkbox"
            checked={automationForm.enabled}
            onChange={(e) =>
              setAutomationForm((prev) => ({ ...prev, enabled: e.target.checked }))
            }
            style={{ marginLeft: "10px" }}
          />
        </div>

        <div style={{ marginTop: "10px" }}>
          <label>Time Length:</label>
          <input
            type="number"
            value={automationForm.timeLength}
            onChange={(e) =>
              setAutomationForm((prev) => ({ ...prev, timeLength: e.target.value }))
            }
            className={styles.automationDatetimeInput}
          />
          <select
            value={automationForm.timeUnit}
            onChange={(e) =>
              setAutomationForm((prev) => ({ ...prev, timeUnit: e.target.value }))
            }
            className={styles.automationDropdownTime}
          >
            <option value="Second">Second</option>
            <option value="Minute">Minute</option>
            <option value="Hour">Hour</option>
          </select>
        </div>

        <div className={styles.automationActionButtonsContainer}>
          {!selectedAutomationId && (
            <button onClick={handleCreateAutomation} className={styles.setButton}>
              Create Automation
            </button>
          )}
          {selectedAutomationId && (
            <>
              <button onClick={handleUpdateAutomation} className={styles.setButton}>
                Update
              </button>
              <button onClick={handleDeleteSelected} className={styles.setButton}>
                Delete
              </button>
            </>
          )}
          <button onClick={clearAllAutomationsHandler} className={styles.setButton}>
            Clear Automations
          </button>
        </div>

        {/* Listing existing automations with a toggle button */}
        <div className={styles.automationExistingList}>
          <h4>Existing Automations</h4>
          {!automations.length ? (
            <p>No automations found.</p>
          ) : (
            automations.map((auto) => (
              <div key={auto.id} className={styles.automationItemRow}>
                <div>
                  <strong>{auto.name}</strong> – {auto.type} – {auto.action} – Board:{" "}
                  {auto.boardType} 
                  {auto.enabled ? " (Enabled)" : " (Disabled)"}
                </div>
                <div>
                  <button
                    onClick={() => handleToggleEnabled(auto.id, auto.enabled)}
                    className={styles.automationToggleButton}
                  >
                    Toggle
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
