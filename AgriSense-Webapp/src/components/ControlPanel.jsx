// ControlPanel.jsx
import React, { useState, useContext } from "react";
import styles from "../ControlPanel.module.css";
import { SensorContext } from "../SensorContext";
import { useDataContext } from "../DataContext";

/**
 * sensorMap: each sensor can map to one or more fields.
 * - "Water Level" gets a numeric reading in "Latest", but we'll replace the
 *   "Edited" text box with a "Fill 100%" button in the UI logic below.
 * - For "Light X," we show numeric + boolean fields, etc.
 */
const sensorMap = {
  "Temperature": [
    { field: "temperature", label: "Temperature", unit: "°C", isBoolean: false },
  ],
  "Humidity": [
    { field: "humidity", label: "Humidity", unit: "%", isBoolean: false },
  ],
  "Soil Moisture": [
    { field: "soilMoisture", label: "Soil Moisture", unit: "%", isBoolean: false },
  ],

  "Water Level": [
    { field: "waterLevel", label: "Water Level", unit: "%", isBoolean: false },
  ],

  "Nutrient 1 Level": [
    { field: "nutrient1", label: "Nutrient 1 Level", unit: "%", isBoolean: false },
  ],
  "Nutrient 2 Level": [
    { field: "nutrient2", label: "Nutrient 2 Level", unit: "%", isBoolean: false },
  ],

  "Light 1": [
    { field: "light1", label: "Light 1", unit: "lux", isBoolean: false },
    { field: "light1State", label: "Light 1 State", isBoolean: true },
  ],
  "Light 2": [
    { field: "light2", label: "Light 2", unit: "lux", isBoolean: false },
    { field: "light2State", label: "Light 2 State", isBoolean: true },
  ],
  "Light 3": [
    { field: "light3", label: "Light 3", unit: "lux", isBoolean: false },
    { field: "light3State", label: "Light 3 State", isBoolean: true },
  ],

  "Fan 1": [{ field: "fan1State", label: "Fan 1 State", isBoolean: true }],
  "Fan 2": [{ field: "fan2State", label: "Fan 2 State", isBoolean: true }],
  "Fan 3": [{ field: "fan3State", label: "Fan 3 State", isBoolean: true }],

  "Humidifier 1": [
    { field: "humidifier1State", label: "Humidifier 1 State", isBoolean: true },
  ],
  "Humidifier 2": [
    { field: "humidifier2State", label: "Humidifier 2 State", isBoolean: true },
  ],
  "Humidifier 3": [
    { field: "humidifier3State", label: "Humidifier 3 State", isBoolean: true },
  ],
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

  // Local state for editing each field (numeric or boolean)
  const [editedData, setEditedData] = useState({
    // numeric
    temperature: "",
    humidity: "",
    soilMoisture: "",
    waterLevel: "",   // We'll override the UI for this below
    nutrient1: "",
    nutrient2: "",
    light1: "",
    light2: "",
    light3: "",
    // boolean
    fan1State: false,
    fan2State: false,
    fan3State: false,
    light1State: false,
    light2State: false,
    light3State: false,
    humidifier1State: false,
    humidifier2State: false,
    humidifier3State: false,
  });

  // Restrict numeric input to digits + special keys
  const handleKeyDown = (e) => {
    const allowed = [
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
    const isNumberKey = /[0-9]/.test(e.key);
    if (!allowed.includes(e.key) && !isNumberKey) {
      e.preventDefault();
    }
  };

  // Single field update
  const handleSetSensor = async (field) => {
    await createNewReading({ [field]: editedData[field] }, sensors);
  };

  // "Set All" updates everything at once
  const handleSetAllSensors = async () => {
    await createNewReading({ ...editedData }, sensors);
  };

  // For Water Level, user only sees a "Fill to 100%" button
  const handleFillWater = async () => {
    await createNewReading({ waterLevel: 100 }, sensors);
  };

  // ─────────────────────────────────────────────────────────────
  //               AUTOMATIONS (UPDATED SECTION)
  // ─────────────────────────────────────────────────────────────

  // We still pull automations from the data context
  const automations = dataState.automations;

  // Local state for which automation is selected & the form data
  const [selectedAutomationId, setSelectedAutomationId] = useState("");

  // We keep boardType (if you want to continue specifying it), otherwise remove it
  const [automationBoardType, setAutomationBoardType] = useState("NSCB");

  // Updated automation form includes "repeatSchedule" instead of "timeLength/timeUnit"
  const [automationForm, setAutomationForm] = useState({
    name: "",
    type: "time-based",
    enabled: true,
    dateTime: "",
    repeatSchedule: "none", // new field for repeating schedule
    sensorField: "temperature",
    operator: ">",
    thresholdValue: "",
    action: "addWater",
  });

  // Create new automation in Firestore (via dataContext)
  const handleCreateAutomation = async () => {
    const payload = {
      ...automationForm,
      boardType: automationBoardType, // if you still want to store boardType
    };
    const newId = await createAutomation(payload);
    if (newId) {
      setSelectedAutomationId(newId);
    }
    // Optionally reset form
    // setAutomationForm({ ...defaults... });
  };

  // Select an existing automation => load into form
  const handleSelectAutomation = (e) => {
    const autoId = e.target.value;
    setSelectedAutomationId(autoId);
    if (!autoId) {
      // Reset form to defaults if no selection
      setAutomationForm({
        name: "",
        type: "time-based",
        enabled: true,
        dateTime: "",
        repeatSchedule: "none",
        sensorField: "temperature",
        operator: ">",
        thresholdValue: "",
        action: "addWater",
      });
      return;
    }
    // Load existing automation from dataContext
    const autoObj = automations.find((a) => a.id === autoId);
    if (autoObj) {
      setAutomationBoardType(autoObj.boardType || "NSCB");
      setAutomationForm({
        name: autoObj.name || "",
        type: autoObj.type || "time-based",
        enabled: autoObj.enabled ?? true,
        dateTime: autoObj.dateTime || "",
        repeatSchedule: autoObj.repeatSchedule || "none",
        sensorField: autoObj.sensorField || "temperature",
        operator: autoObj.operator || ">",
        thresholdValue: autoObj.thresholdValue?.toString() || "",
        action: autoObj.action || "addWater",
      });
    }
  };

  // Update the selected automation
  const handleUpdateAutomation = async () => {
    if (!selectedAutomationId) return;
    const payload = {
      ...automationForm,
      boardType: automationBoardType,
    };
    await updateAutomation(selectedAutomationId, payload);
  };

  // Delete the currently selected automation
  const handleDeleteSelected = async () => {
    if (!selectedAutomationId) return;
    await deleteAutomation(selectedAutomationId);
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
      action: "addWater",
    });
  };

  // Toggle automation's "enabled" state
  const handleToggleEnabled = async (autoId, curVal) => {
    await updateAutomation(autoId, { enabled: !curVal });
  };

  // Clear all automations from Firestore
  const clearAllAutomationsHandler = async () => {
    await clearAllAutomations();
  };

  // Renders how each automation is shown in the existing list
  function computeAutomationLabel(auto) {
    return `${auto.name} (${auto.type})`;
  }

  // ─────────────────────────────────────────────────────────────
  //                RENDERING THE COMPONENT
  // ─────────────────────────────────────────────────────────────

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
              const fieldDefs = sensorMap[sensorName];
              if (!fieldDefs) return null;

              return fieldDefs.map(({ field, label, unit, isBoolean }) => {
                // "Latest" value from Firestore (read-only)
                let latestVal = latestData[field];
                if (typeof latestVal === "undefined" || latestVal === null) {
                  latestVal = isBoolean ? false : "";
                }

                // Decide how to render the "edited" cell and "Set" cell
                let editedCell, setCell;

                if (field === "waterLevel") {
                  // Instead of showing a numeric text box, we show "Fill to 100%" here.
                  editedCell = (
                    <button
                      onClick={handleFillWater}
                      className={styles.setButton}
                    >
                      Fill to 100%
                    </button>
                  );
                  // No dedicated "Set" button for water level
                  setCell = <div />; // empty placeholder
                } else if (isBoolean) {
                  // Show a checkbox for booleans
                  editedCell = (
                    <label style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!editedData[field]}
                        onChange={(e) =>
                          setEditedData((prev) => ({
                            ...prev,
                            [field]: e.target.checked,
                          }))
                        }
                      />
                      <span style={{ marginLeft: "6px" }}>
                        {editedData[field] ? "On" : "Off"}
                      </span>
                    </label>
                  );

                  // A normal "Set" button for booleans
                  setCell = (
                    <button
                      onClick={() => handleSetSensor(field)}
                      className={styles.setButton}
                    >
                      Set
                    </button>
                  );
                } else {
                  // Numeric => text box plus "Set" button
                  editedCell = (
                    <input
                      type="number"
                      value={editedData[field]}
                      onChange={(e) =>
                        setEditedData((prev) => ({
                          ...prev,
                          [field]: e.target.value,
                        }))
                      }
                      onKeyDown={handleKeyDown}
                      className={styles.sensorInput}
                    />
                  );
                  setCell = (
                    <button
                      onClick={() => handleSetSensor(field)}
                      className={styles.setButton}
                    >
                      Set
                    </button>
                  );
                }

                return (
                  <React.Fragment key={field}>
                    {/* LABEL */}
                    <div className={styles.rowLabel}>
                      <strong>{label}:</strong>
                    </div>

                    {/* LATEST (read‐only) */}
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

                    {/* EDITED (checkbox, numeric input, or Fill button) */}
                    <div className={styles.rowEdited}>{editedCell}</div>

                    {/* Single "Set" button or empty if water */}
                    <div className={styles.rowSet}>{setCell}</div>
                  </React.Fragment>
                );
              });
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

      {/* AUTOMATIONS (NEW LOGIC / LAYOUT) */}
      <div className={styles.automationContainer}>
        <h3>Automations</h3>
        <p className={styles.automationPurpose}>
          <strong>Purpose of Automation</strong>
          <br />
          Automations let you perform actions (e.g., add water, turn off lights)
          automatically based on conditions (time-based or threshold-based).
        </p>

        {/* Select existing or create new */}
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

        {/* Board Type (if you want to keep it) */}
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

        {/* Grid with 4 columns and 2 rows (like in the reference) */}
        <div className={styles.automationGrid4col}>
          {/* Left column: Name */}
          <div className={styles.automationLeft}>
            <label className={styles.automationStep}>Name</label>
            <input
              type="text"
              className={styles.automationNameInput}
              value={automationForm.name}
              onChange={(e) =>
                setAutomationForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          {/* Middle: Type */}
          <div className={styles.automationMiddle}>
            <label className={styles.automationStep}>Type</label>
            <div className={styles.automationSelectBlock}>
              <select
                value={automationForm.type}
                onChange={(e) =>
                  setAutomationForm((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }))
                }
                className={styles.automationDropdown}
              >
                <option value="time-based">Time-Based</option>
                <option value="threshold-based">Threshold-Based</option>
              </select>
            </div>
          </div>

          {/* Right: If time-based => dateTime, else threshold-based => sensor/operator/threshold */}
          <div className={styles.automationRight}>
            {automationForm.type === "time-based" ? (
              <>
                <label className={styles.automationLabelMargin}>Date/Time</label>
                <input
                  type="datetime-local"
                  className={styles.automationDatetimeInput}
                  value={automationForm.dateTime}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      dateTime: e.target.value,
                    }))
                  }
                />
              </>
            ) : (
              <>
                <label className={styles.automationLabelMargin}>
                  Sensor Field
                </label>
                <select
                  className={`${styles.automationDropdown} ${styles.automationSelectMargin}`}
                  value={automationForm.sensorField}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      sensorField: e.target.value,
                    }))
                  }
                >
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                  <option value="soilMoisture">Soil Moisture</option>
                  <option value="light1">Light 1</option>
                  <option value="light2">Light 2</option>
                  <option value="light3">Light 3</option>
                  <option value="waterLevel">Water Level</option>
                  <option value="nutrient1">Nutrient 1</option>
                  <option value="nutrient2">Nutrient 2</option>
                </select>
                <label className={styles.automationLabelMargin}>Operator</label>
                <select
                  className={`${styles.automationDropdown} ${styles.automationSelectMargin}`}
                  value={automationForm.operator}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      operator: e.target.value,
                    }))
                  }
                >
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="=">=</option>
                </select>
                <label className={styles.automationLabelMargin}>Threshold</label>
                <input
                  type="number"
                  className={`${styles.automationNameInput} ${styles.automationSelectMargin}`}
                  value={automationForm.thresholdValue}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      thresholdValue: e.target.value,
                    }))
                  }
                />
              </>
            )}
          </div>

          {/* 4th col: Action + create/update/delete */}
          <div className={styles.automationSaved}>
            <label>Action</label>
            <select
              className={styles.automationDropdown}
              value={automationForm.action}
              onChange={(e) =>
                setAutomationForm((prev) => ({
                  ...prev,
                  action: e.target.value,
                }))
              }
            >
              {/* Adjust these to your desired actions or keep the reference's */}
              <option value="addWater">Add Water</option>
              <option value="drainWater">Drain Water</option>
              <option value="addNutrients">Add Nutrients</option>
              <option value="turnOnLights">Turn On Lights</option>
              <option value="turnOffLights">Turn Off Lights</option>
            </select>

            <div className={styles.automationActionButtonsContainer}>
              {!selectedAutomationId && (
                <button
                  onClick={handleCreateAutomation}
                  className={`${styles.setButton} ${styles.automationSpaceRight}`}
                >
                  Create
                </button>
              )}
              {selectedAutomationId && (
                <>
                  <button
                    onClick={handleUpdateAutomation}
                    className={`${styles.setButton} ${styles.automationSpaceRight}`}
                  >
                    Update
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className={styles.setButton}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Empty left cell below */}
          <div className={styles.automationLeftEmpty}></div>

          {/* Middle cell: Enabled checkbox */}
          <div className={styles.automationMiddleEnabled}>
            <label className={styles.automationEnabledLabel}>Enabled?</label>
            <input
              type="checkbox"
              checked={automationForm.enabled}
              onChange={(e) =>
                setAutomationForm((prev) => ({
                  ...prev,
                  enabled: e.target.checked,
                }))
              }
            />
          </div>

          {/* Right cell: Repeat schedule if time-based */}
          <div className={styles.automationRightRepeat}>
            {automationForm.type === "time-based" && (
              <>
                <label className={styles.automationRepeatLabel}>Repeat</label>
                <select
                  className={styles.automationDropdownTime}
                  value={automationForm.repeatSchedule}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      repeatSchedule: e.target.value,
                    }))
                  }
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </>
            )}
          </div>
          <div className={styles.automationSavedEmpty}></div>
        </div>

        {/* Existing automations listing */}
        <div className={styles.automationExistingList}>
          <h4>Existing Automations</h4>
          {!automations.length ? (
            <p>No automations found.</p>
          ) : (
            automations.map((auto) => (
              <div key={auto.id} className={styles.automationItemRow}>
                <div>
                  <strong>{auto.name}</strong> – {auto.type} – {auto.action} –
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

        <button
          onClick={clearAllAutomationsHandler}
          className={`${styles.setButton} ${styles.automationClearButton}`}
        >
          Clear All Automations
        </button>
      </div>
      {/* End of updated Automations container */}
    </div>
  );
}

export default ControlPanel;
