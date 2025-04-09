import React, { useState, useContext, useEffect } from "react";
import styles from "../ControlPanel.module.css";
import { SensorContext } from "../SensorContext";
import { useDataContext } from "../DataContext";

// Mapping each sensor to Firestore fields
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
    temperature: "",
    humidity: "",
    soilMoisture: "",
    waterLevel: "",
    nutrient1: "",
    nutrient2: "",
    light1: "",
    light2: "",
    light3: "",
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

  // Restrict numeric input
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
    const isNumberKey = /[0-9]/.test(e.key);
    if (!allowedKeys.includes(e.key) && !isNumberKey) {
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

  // ------------------------------------------------------------
  // AUTOMATIONS
  // ------------------------------------------------------------
  const automations = dataState.automations;
  const [selectedAutomationId, setSelectedAutomationId] = useState("");

  // Board type selection
  const [automationBoardType, setAutomationBoardType] = useState("HPCB");

  const [automationForm, setAutomationForm] = useState({
    name: "",
    type: "time-based", // "time-based", "time-length-based", "volume-based", "threshold-based"
    enabled: true,
    dateTime: "",
    timeLength: "",
    timeUnit: "Second",
    repeatSchedule: "none",
    sensorField: "temperature",
    operator: ">",
    thresholdValue: "",
    action: "turnOnLight",
    volumeMl: "",
  });

  // Ensure the action is valid for the selected board type
  useEffect(() => {
    setAutomationForm((prev) => {
      const validHpcb = ["turnOnLight", "turnOnFan", "turnOnHumidifier"];
      const validNscb = ["addWater", "addNutrient1", "addNutrient2"];
      if (automationBoardType === "HPCB") {
        if (!validHpcb.includes(prev.action)) {
          return { ...prev, action: "turnOnLight" };
        }
      } else {
        if (!validNscb.includes(prev.action)) {
          return { ...prev, action: "addWater" };
        }
      }
      return prev;
    });
  }, [automationBoardType]);

  const handleCreateAutomation = async () => {
    // ADDED: pass selectedInstance as instanceNumber
    const payload = {
      ...automationForm,
      boardType: automationBoardType,
      instanceNumber: selectedInstance, // ADDED
    };
    const newId = await createAutomation(payload, sensors);
    if (newId) {
      setSelectedAutomationId(newId);
    }
  };

  const handleSelectAutomation = (e) => {
    const autoId = e.target.value;
    setSelectedAutomationId(autoId);

    if (!autoId) {
      setAutomationBoardType("HPCB");
      setAutomationForm({
        name: "",
        type: "time-based",
        enabled: true,
        dateTime: "",
        timeLength: "",
        timeUnit: "Second",
        repeatSchedule: "none",
        sensorField: "temperature",
        operator: ">",
        thresholdValue: "",
        action: "turnOnLight",
        volumeMl: "",
      });
      return;
    }

    const autoObj = automations.find((a) => a.id === autoId);
    if (autoObj) {
      setAutomationBoardType(autoObj.boardType || "HPCB");
      setAutomationForm({
        name: autoObj.name || "",
        type: autoObj.type || "time-based",
        enabled: autoObj.enabled ?? true,
        dateTime: autoObj.timestamp ? autoObj.timestamp.slice(0, 16) : "",
        timeLength: autoObj.timeLength?.toString() || "",
        timeUnit: autoObj.timeLengthType || "Second",
        repeatSchedule: autoObj.repeat || "none",
        sensorField: autoObj.sensorField || "temperature",
        operator: autoObj.operator || ">",
        thresholdValue: autoObj.thresholdNumber?.toString() || "",
        action: autoObj.action || "",
        volumeMl: autoObj.volume?.toString() || "",
      });
    }
  };

  const handleUpdateAutomation = async () => {
    if (!selectedAutomationId) return;
    // ADDED: pass selectedInstance as instanceNumber
    const payload = {
      ...automationForm,
      boardType: automationBoardType,
      instanceNumber: selectedInstance, // ADDED
    };
    await updateAutomation(selectedAutomationId, payload, sensors);
  };

  const handleDeleteSelected = async () => {
    if (!selectedAutomationId) return;
    await deleteAutomation(selectedAutomationId);
    setSelectedAutomationId("");
    setAutomationBoardType("HPCB");
    setAutomationForm({
      name: "",
      type: "time-based",
      enabled: true,
      dateTime: "",
      timeLength: "",
      timeUnit: "Second",
      repeatSchedule: "none",
      sensorField: "temperature",
      operator: ">",
      thresholdValue: "",
      action: "turnOnLight",
      volumeMl: "",
    });
  };

  const handleDeleteFromList = async (automationId) => {
    await deleteAutomation(automationId);
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

      {/* SENSOR CONTROL */}
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
                let latestVal = latestData[field];
                if (typeof latestVal === "undefined" || latestVal === null) {
                  latestVal = isBoolean ? false : "";
                }

                let editedCell, setCell;

                if (field === "waterLevel") {
                  editedCell = (
                    <button
                      onClick={handleFillWater}
                      className={styles.setWaterButton}
                    >
                      Fill to 100%
                    </button>
                  );
                  setCell = <div />;
                } else if (isBoolean) {
                  editedCell = (
                    <div
                      style={{
                        display: "flex",
                        gap: "1rem",
                        marginLeft: "35px",
                      }}
                    >
                      <label>
                        <input
                          type="radio"
                          name={field}
                          value="on"
                          checked={editedData[field] === true}
                          onChange={() =>
                            setEditedData((prev) => ({
                              ...prev,
                              [field]: true,
                            }))
                          }
                        />
                        On
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={field}
                          value="off"
                          checked={editedData[field] === false}
                          onChange={() =>
                            setEditedData((prev) => ({
                              ...prev,
                              [field]: false,
                            }))
                          }
                        />
                        Off
                      </label>
                    </div>
                  );
                  setCell = (
                    <button
                      onClick={() => handleSetSensor(field)}
                      className={styles.setButton}
                    >
                      Set
                    </button>
                  );
                } else {
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
                    <div className={styles.rowLabel}>
                      <strong>{label}:</strong>
                    </div>
                    {/* Latest */}
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
                    {/* Edited cell */}
                    <div className={styles.rowEdited}>{editedCell}</div>
                    {/* Set button */}
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

      {/* AUTOMATIONS */}
      <div className={styles.automationContainer}>
        <h3>Automations</h3>
        <p className={styles.automationPurpose}>
          <strong>Purpose of Automation</strong>
          <br />
          Automations let you perform actions (e.g., add water, turn on fan)
          automatically based on conditions (time-based, time-length-based,
          volume-based, or threshold-based).
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
            <option value="HPCB">HPCB</option>
            <option value="NSCB">NSCB</option>
          </select>
        </div>

        <div className={styles.automationGrid5col}>
          {/* 1) Name */}
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

          {/* 2) Type */}
          <div className={styles.automationMiddle}>
            <label className={styles.automationStep}>Type</label>
            <div className={styles.automationSelectBlock}>
              <select
                value={automationForm.type}
                onChange={(e) =>
                  setAutomationForm((prev) => ({ ...prev, type: e.target.value }))
                }
                className={styles.automationDropdown}
              >
                <option value="time-based">Time-Based</option>
                {automationBoardType === "NSCB" ? (
                  <option value="volume-based">Volume-Based</option>
                ) : (
                  <option value="time-length-based">Time-Length-Based</option>
                )}
                <option value="threshold-based">Threshold-Based</option>
              </select>
            </div>
          </div>

          {/* 3) Date/Time or Sensor Field or Volume */}
          <div className={styles.automationRight}>
            {automationForm.type === "time-based" && (
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
            )}

            {automationForm.type === "volume-based" && (
              <>
                <label className={styles.automationLabelMargin}>Volume (mL)</label>
                <input
                  type="number"
                  className={styles.automationDatetimeInput}
                  value={automationForm.volumeMl}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      volumeMl: e.target.value,
                    }))
                  }
                />
              </>
            )}

            {automationForm.type === "time-length-based" && (
              <>
                <label className={styles.automationLabelMargin}>Time Length</label>
                <input
                  type="number"
                  className={styles.automationDatetimeInput}
                  value={automationForm.timeLength}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      timeLength: e.target.value,
                    }))
                  }
                />
                <select
                  className={styles.automationDropdown}
                  value={automationForm.timeUnit}
                  onChange={(e) =>
                    setAutomationForm((prev) => ({
                      ...prev,
                      timeUnit: e.target.value,
                    }))
                  }
                >
                  <option value="Second">Second</option>
                  <option value="Minute">Minute</option>
                  <option value="Hour">Hour</option>
                </select>
              </>
            )}

            {automationForm.type === "threshold-based" && (
              <>
                <label className={styles.automationLabelMargin}>Variable Field</label>
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
                  {sensors.filter((s) => sensorMap[s]?.some((def) => !def.isBoolean)).length >
                  0 ? (
                    sensors
                      .filter((s) => sensorMap[s]?.some((def) => !def.isBoolean))
                      .map((sensor) => {
                        const mapping = sensorMap[sensor];
                        const numericDef = mapping.find((def) => !def.isBoolean);
                        return (
                          <option key={sensor} value={numericDef.field}>
                            {sensor}
                          </option>
                        );
                      })
                  ) : (
                    <option value="">No numeric sensors available</option>
                  )}
                </select>
                <label className={styles.automationLabelField}>Operator</label>
                <select
                  className={`${styles.automationDropdown} ${styles.automationSelectMarginField}`}
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
                <label className={styles.automationLabelField}>Threshold</label>
                <input
                  type="number"
                  className={`${styles.automationNameInput} ${styles.automationSelectMarginField}`}
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

          {/* 4) Extra column: time-length (for time-based/threshold-based on HPCB) or volume (for NSCB) */}
          <div className={styles.automationTimeLength}>
            {(() => {
              if (
                (automationForm.type === "time-based" ||
                  automationForm.type === "threshold-based") &&
                automationBoardType !== "NSCB"
              ) {
                return (
                  <>
                    <label className={styles.automationLabelMargin}>Time Length</label>
                    <input
                      type="number"
                      className={`${styles.automationNameInput} ${styles.automationSelectMargin}`}
                      value={automationForm.timeLength}
                      onChange={(e) =>
                        setAutomationForm((prev) => ({
                          ...prev,
                          timeLength: e.target.value,
                        }))
                      }
                    />
                    <select
                      className={`${styles.automationDropdown} ${styles.automationSelectMargin}`}
                      value={automationForm.timeUnit}
                      onChange={(e) =>
                        setAutomationForm((prev) => ({
                          ...prev,
                          timeUnit: e.target.value,
                        }))
                      }
                    >
                      <option value="Second">Second</option>
                      <option value="Minute">Minute</option>
                      <option value="Hour">Hour</option>
                    </select>
                  </>
                );
              }
              if (
                (automationForm.type === "time-based" ||
                  automationForm.type === "threshold-based") &&
                automationBoardType === "NSCB"
              ) {
                return (
                  <>
                    <label className={styles.automationLabelMargin}>Volume (mL)</label>
                    <input
                      type="number"
                      className={`${styles.automationNameInput} ${styles.automationSelectMargin}`}
                      value={automationForm.volumeMl}
                      onChange={(e) =>
                        setAutomationForm((prev) => ({
                          ...prev,
                          volumeMl: e.target.value,
                        }))
                      }
                    />
                  </>
                );
              }
            })()}
          </div>

          {/* 5) Action */}
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
              {automationBoardType === "HPCB" && (
                <>
                  <option value="turnOnLight">Turn On Light</option>
                  <option value="turnOnFan">Turn On Fan</option>
                  <option value="turnOnHumidifier">Turn On Humidifier</option>
                </>
              )}
              {automationBoardType === "NSCB" && (
                <>
                  <option value="addWater">Add Water</option>
                  <option value="addNutrient1">Add Nutrient 1</option>
                  <option value="addNutrient2">Add Nutrient 2</option>
                </>
              )}
            </select>
          </div>

          {/* SECOND ROW */}
          <div className={styles.automationLeftEmpty}></div>
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
          <div className={styles.automationTimeEmpty}></div>
          <div className={styles.automationSavedEmpty}>
            {!selectedAutomationId && (
              <button
                onClick={handleCreateAutomation}
                className={styles.setButton}
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

        {/* Existing Automations */}
        <div className={styles.automationExistingList}>
          <h4>Existing Automations</h4>
          {!automations.length ? (
            <p>No automations found.</p>
          ) : (
            automations.map((auto) => (
              <div key={auto.id} className={styles.automationItemRow}>
                <div>
                  <strong>{auto.name}</strong> – {auto.type} – {auto.action} –{" "}
                  {auto.enabled ? "(Enabled)" : "(Disabled)"}
                </div>
                <div>
                  <button
                    onClick={() => handleDeleteFromList(auto.id)}
                    className={styles.automationToggleButton}
                  >
                    Delete
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
    </div>
  );
}

export default ControlPanel;
