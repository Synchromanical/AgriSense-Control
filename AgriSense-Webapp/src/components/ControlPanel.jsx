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
  This component now supports:
  - temperature, humidity, soil moisture (GSMB),
  - fan1State, fan2State, fan3State, light1/light1State, etc. (HPCB),
  - humidifier1State, humidifier2State, humidifier3State (also HPCB),
  - waterLevel (NSCB).
  
  Automations are handled in the second half of this file.
*/
const ControlPanel = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];

  // Store the latest reading from Firestore
  const [latestData, setLatestData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light1: "",
    light2: "",
    light3: "",
    light1State: false,
    light2State: false,
    light3State: false,
    fan1State: false,
    fan2State: false,
    fan3State: false,
    // Newly added humidifier states:
    humidifier1State: false,
    humidifier2State: false,
    humidifier3State: false,

    waterLevel: "",
    timestamp: null,
  });

  // Store user-edited data (to "set" in Firestore)
  const [editedData, setEditedData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light1: "",
    light2: "",
    light3: "",
    light1State: false,
    light2State: false,
    light3State: false,
    fan1State: false,
    fan2State: false,
    fan3State: false,
    // Newly added humidifier states:
    humidifier1State: false,
    humidifier2State: false,
    humidifier3State: false,

    waterLevel: "",
  });

  // Automations state
  const [automations, setAutomations] = useState([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState("");
  // Board type for new automations
  const [automationBoardType, setAutomationBoardType] = useState("NSCB");
  // Form fields for the automation creation/update
  const [automationForm, setAutomationForm] = useState({
    name: "",
    type: "time-based",
    enabled: true,
    dateTime: "",
    sensorField: "temperature",
    operator: ">",
    thresholdValue: "",
    // Default action for NSCB is addWater
    action: "addWater",
    timeLength: "",
    timeUnit: "Second",
  });

  // Fetch and listen for changes in the "automations" collection
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "automations"), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAutomations(docs);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to sensor updates from Firestore
  useEffect(() => {
    const collectionsNeeded = {};
    // Determine which board(s) to listen to and which fields
    sensors.forEach((sensorName) => {
      const key = sensorName.toLowerCase().replace(/\s/g, "");

      // For GSMB sensors:
      if (key === "temperature" || key === "humidity" || key === "soilmoisture") {
        collectionsNeeded["GSMB"] = collectionsNeeded["GSMB"] || new Set();
        if (key === "temperature") collectionsNeeded["GSMB"].add("temperature");
        if (key === "humidity") collectionsNeeded["GSMB"].add("humidity");
        if (key === "soilmoisture") collectionsNeeded["GSMB"].add("soilMoisture");
      }

      // For HPCB (fans, lights, humidifiers):
      if (sensorName.startsWith("Fan ")) {
        const number = sensorName.split(" ")[1];
        collectionsNeeded["HPCB"] = collectionsNeeded["HPCB"] || new Set();
        collectionsNeeded["HPCB"].add(`fan${number}State`);
      }
      if (sensorName.startsWith("Light ")) {
        const number = sensorName.split(" ")[1];
        collectionsNeeded["HPCB"] = collectionsNeeded["HPCB"] || new Set();
        collectionsNeeded["HPCB"].add(`light${number}`);
        collectionsNeeded["HPCB"].add(`light${number}State`);
      }
      if (sensorName.startsWith("Humidifier ")) {
        const number = sensorName.split(" ")[1];
        collectionsNeeded["HPCB"] = collectionsNeeded["HPCB"] || new Set();
        collectionsNeeded["HPCB"].add(`humidifier${number}State`);
      }

      // For NSCB
      if (sensorName.toLowerCase().includes("water")) {
        collectionsNeeded["NSCB"] = collectionsNeeded["NSCB"] || new Set();
        collectionsNeeded["NSCB"].add("waterLevel");
      }
      if (sensorName.toLowerCase().includes("nutrient")) {
        // If you track nutrients in NSCB, you can add them here the same way
        collectionsNeeded["NSCB"] = collectionsNeeded["NSCB"] || new Set();
        // e.g. collectionsNeeded["NSCB"].add("nutrientLevel1");
      }
    });

    // For each needed collection, subscribe to the most recent doc
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
                if (typeof data[field] === "boolean") {
                  newData[field] = data[field];
                } else {
                  newData[field] = formatOneDecimal(data[field]);
                }
              }
            });
            newData.timestamp = data.timestamp;
            return newData;
          });
          setEditedData((prev) => {
            const newData = { ...prev };
            fieldsSet.forEach((field) => {
              if (data[field] !== undefined) {
                if (typeof data[field] === "boolean") {
                  newData[field] = data[field];
                } else {
                  newData[field] = formatOneDecimal(data[field]);
                }
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

  // Creates new doc(s) in Firestore with the updated fields
  async function createNewReading(updatedFields) {
    const activeBoards = new Set();
    // Figure out which boards to write to based on user’s active sensors
    sensors.forEach((sensorName) => {
      const key = sensorName.toLowerCase().replace(/\s/g, "");
      if (key === "temperature" || key === "humidity" || key === "soilmoisture") {
        activeBoards.add("GSMB");
      }
      if (
        sensorName.startsWith("Fan ") ||
        sensorName.startsWith("Light ") ||
        sensorName.startsWith("Humidifier ")
      ) {
        activeBoards.add("HPCB");
      }
      if (
        sensorName.toLowerCase().includes("water") ||
        sensorName.toLowerCase().includes("nutrient")
      ) {
        activeBoards.add("NSCB");
      }
    });

    const timestamp = getTimestampString();
    for (const board of activeBoards) {
      // Only add fields for sensors that are actually active
      let docData = { boardType: board, timestamp };

      if (board === "GSMB") {
        if (sensors.includes("Temperature")) {
          docData.temperature = parseFloat(
            updatedFields.temperature ?? latestData.temperature ?? 0
          ) || 0;
        }
        if (sensors.includes("Humidity")) {
          docData.humidity = parseFloat(
            updatedFields.humidity ?? latestData.humidity ?? 0
          ) || 0;
        }
        if (sensors.includes("Soil Moisture")) {
          docData.soilMoisture = parseFloat(
            updatedFields.soilMoisture ?? latestData.soilMoisture ?? 0
          ) || 0;
        }
      } else if (board === "HPCB") {
        // Fans
        if (sensors.includes("Fan 1")) {
          docData.fan1State =
            updatedFields.fan1State ?? latestData.fan1State ?? false;
        }
        if (sensors.includes("Fan 2")) {
          docData.fan2State =
            updatedFields.fan2State ?? latestData.fan2State ?? false;
        }
        if (sensors.includes("Fan 3")) {
          docData.fan3State =
            updatedFields.fan3State ?? latestData.fan3State ?? false;
        }

        // Lights
        if (sensors.includes("Light 1")) {
          docData.light1 =
            parseFloat(updatedFields.light1 ?? latestData.light1 ?? 0) || 0;
          docData.light1State =
            updatedFields.light1State ?? latestData.light1State ?? false;
        }
        if (sensors.includes("Light 2")) {
          docData.light2 =
            parseFloat(updatedFields.light2 ?? latestData.light2 ?? 0) || 0;
          docData.light2State =
            updatedFields.light2State ?? latestData.light2State ?? false;
        }
        if (sensors.includes("Light 3")) {
          docData.light3 =
            parseFloat(updatedFields.light3 ?? latestData.light3 ?? 0) || 0;
          docData.light3State =
            updatedFields.light3State ?? latestData.light3State ?? false;
        }

        // Humidifiers
        if (sensors.includes("Humidifier 1")) {
          docData.humidifier1State =
            updatedFields.humidifier1State ?? latestData.humidifier1State ?? false;
        }
        if (sensors.includes("Humidifier 2")) {
          docData.humidifier2State =
            updatedFields.humidifier2State ?? latestData.humidifier2State ?? false;
        }
        if (sensors.includes("Humidifier 3")) {
          docData.humidifier3State =
            updatedFields.humidifier3State ?? latestData.humidifier3State ?? false;
        }
      } else if (board === "NSCB") {
        if (sensors.includes("Water Level")) {
          docData.waterLevel = parseFloat(
            updatedFields.waterLevel ?? latestData.waterLevel ?? 0
          ) || 0;
        }
          // If you have nutrient fields, set them here similarly
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

  // Set an individual sensor
  const handleSetSensor = async (field) => {
    const newValue = editedData[field];
    await createNewReading({ [field]: newValue });
  };

  // Set all sensors at once
  const handleSetAllSensors = async () => {
    const updateObj = {};
    if (editedData.temperature !== "") updateObj.temperature = editedData.temperature;
    if (editedData.humidity !== "") updateObj.humidity = editedData.humidity;
    if (editedData.soilMoisture !== "") updateObj.soilMoisture = editedData.soilMoisture;

    updateObj.light1 = editedData.light1;
    updateObj.light2 = editedData.light2;
    updateObj.light3 = editedData.light3;
    updateObj.light1State = editedData.light1State;
    updateObj.light2State = editedData.light2State;
    updateObj.light3State = editedData.light3State;

    updateObj.fan1State = editedData.fan1State;
    updateObj.fan2State = editedData.fan2State;
    updateObj.fan3State = editedData.fan3State;

    // Humidifiers
    updateObj.humidifier1State = editedData.humidifier1State;
    updateObj.humidifier2State = editedData.humidifier2State;
    updateObj.humidifier3State = editedData.humidifier3State;

    if (editedData.waterLevel !== undefined) {
      updateObj.waterLevel = editedData.waterLevel;
    }
    await createNewReading(updateObj);
  };

  const handleFillWater = async () => {
    await createNewReading({ waterLevel: 100 });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTOMATION LOGIC
  // ─────────────────────────────────────────────────────────────────────────────

  // When user picks HPCB or NSCB in the dropdown, we track that in automationBoardType
  const handleAutomationBoardTypeChange = (e) => {
    const newBoard = e.target.value;
    setAutomationBoardType(newBoard);

    // If we switch from NSCB <-> HPCB, adjust the default action
    if (newBoard === "NSCB") {
      setAutomationForm((prev) => ({
        ...prev,
        action: "addWater", // e.g. default
      }));
    } else {
      setAutomationForm((prev) => ({
        ...prev,
        action: "turnFanOn", // e.g. default
      }));
    }
  };

  // Return a simplified action for storing in Firestore
  const getStoredAction = () => {
    if (automationBoardType === "NSCB") {
      if (automationForm.action === "addWater") return "water";
      if (automationForm.action === "addNutrient") return "nutrient";
    } else if (automationBoardType === "HPCB") {
      if (automationForm.action === "turnFanOn") return "fan";
      if (automationForm.action === "turnLightOn") return "light";
      // You can extend to "turnHumidifierOn", etc., if desired
    }
    return automationForm.action;
  };

  const handleAutomationFormChange = (field, value) => {
    setAutomationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetAutomationForm = () => {
    setAutomationForm({
      name: "",
      type: "time-based",
      enabled: true,
      dateTime: "",
      sensorField: "temperature",
      operator: ">",
      thresholdValue: "",
      action: automationBoardType === "NSCB" ? "addWater" : "turnFanOn",
      timeLength: "",
      timeUnit: "Second",
    });
  };

  // Create a new automation
  const handleCreateAutomation = async () => {
    try {
      let payload = {
        name: automationForm.name,
        type: automationForm.type,
        boardType: automationBoardType,
        enabled: automationForm.enabled,
        action: getStoredAction(),
      };
      if (automationForm.type === "time-based") {
        payload.dateTime = automationForm.dateTime;
      } else if (automationForm.type === "threshold-based") {
        payload.sensorField = automationForm.sensorField;
        payload.operator = automationForm.operator;
        payload.thresholdValue = automationForm.thresholdValue
          ? parseFloat(automationForm.thresholdValue)
          : "";
      } else if (automationForm.type === "time-length-based") {
        payload.timeLength = automationForm.timeLength
          ? parseFloat(automationForm.timeLength)
          : 0;
        payload.timeLengthType = automationForm.timeUnit.toLowerCase();
      }
      const docRef = await addDoc(collection(db, "automations"), payload);
      console.log("Created automation with ID:", docRef.id);
      resetAutomationForm();
      setSelectedAutomationId(docRef.id);
    } catch (error) {
      console.error("Error creating automation:", error);
    }
  };

  // Called when user selects an existing automation in the <select>
  const handleSelectAutomation = (e) => {
    const id = e.target.value;
    setSelectedAutomationId(id);
    if (!id) {
      resetAutomationForm();
      return;
    }
    const found = automations.find((a) => a.id === id);
    if (found) {
      setAutomationBoardType(found.boardType || "NSCB"); // or "HPCB"
      setAutomationForm({
        name: found.name ?? "",
        type: found.type ?? "time-based",
        enabled: typeof found.enabled === "boolean" ? found.enabled : true,
        dateTime: found.dateTime ?? "",
        sensorField: found.sensorField ?? "temperature",
        operator: found.operator ?? ">",
        thresholdValue: found.thresholdValue ? found.thresholdValue.toString() : "",
        // Convert the stored "action" back to a UI label:
        action:
          found.boardType === "NSCB"
            ? found.action === "water"
              ? "addWater"
              : found.action === "nutrient"
              ? "addNutrient"
              : found.action
            : found.action === "fan"
            ? "turnFanOn"
            : found.action === "light"
            ? "turnLightOn"
            : found.action,
        timeLength: found.timeLength ? found.timeLength.toString() : "",
        timeUnit: found.timeLengthType
          ? found.timeLengthType.charAt(0).toUpperCase() +
            found.timeLengthType.slice(1)
          : "Second",
      });
    }
  };

  // Update an existing automation
  const handleUpdateAutomation = async () => {
    if (!selectedAutomationId) return;
    try {
      let payload = {
        name: automationForm.name,
        type: automationForm.type,
        boardType: automationBoardType,
        enabled: automationForm.enabled,
        action: getStoredAction(),
      };
      if (automationForm.type === "time-based") {
        payload.dateTime = automationForm.dateTime;
      } else if (automationForm.type === "threshold-based") {
        payload.sensorField = automationForm.sensorField;
        payload.operator = automationForm.operator;
        payload.thresholdValue = automationForm.thresholdValue
          ? parseFloat(automationForm.thresholdValue)
          : "";
      } else if (automationForm.type === "time-length-based") {
        payload.timeLength = automationForm.timeLength
          ? parseFloat(automationForm.timeLength)
          : 0;
        payload.timeLengthType = automationForm.timeUnit.toLowerCase();
      }
      const docRef = doc(db, "automations", selectedAutomationId);
      await updateDoc(docRef, payload);
      console.log("Updated automation:", selectedAutomationId);
    } catch (error) {
      console.error("Error updating automation:", error);
    }
  };

  // Toggle an automation's `enabled` field
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

  // Clear all automations in the Firestore "automations" collection
  const handleClearAutomations = async () => {
    try {
      const snap = await import("firebase/firestore").then(({ getDocs }) =>
        getDocs(collection(db, "automations"))
      );
      for (const autoDoc of snap.docs) {
        await deleteDoc(doc(db, "automations", autoDoc.id));
      }
      setSelectedAutomationId("");
      resetAutomationForm();
    } catch (error) {
      console.error("Error clearing automations:", error);
    }
  };

  // Delete the currently selected automation
  const handleDeleteSelected = async () => {
    if (!selectedAutomationId) return;
    try {
      await deleteDoc(doc(db, "automations", selectedAutomationId));
      setSelectedAutomationId("");
      resetAutomationForm();
    } catch (error) {
      console.error("Error deleting automation:", error);
    }
  };

  // Different action dropdown options for NSCB vs HPCB
  const actionOptions =
    automationBoardType === "NSCB"
      ? [
          { value: "addWater", label: "Add Water" },
          { value: "addNutrient", label: "Add Nutrient" },
        ]
      : [
          { value: "turnFanOn", label: "Turn Fan On" },
          { value: "turnLightOn", label: "Turn Light On" },
          // You could add more, e.g. { value: "turnHumidifierOn", label: "Turn Humidifier On" }
        ];

  const computeAutomationLabel = (auto) => {
    return `${auto.name} (${auto.type})`;
  };

  return (
    <div className={styles.content}>
      <h2>Control Panel</h2>

      {/* ──────────────────────────────────────────────────────────
          SENSOR CONTROL AREA
      ────────────────────────────────────────────────────────── */}
      <div className={styles.controlPanelContainer}>
        <h3>Sensor Control</h3>
        {sensors.length === 0 ? (
          <p>Please select a sensor in the Sensor tab to control.</p>
        ) : (
          <div className={styles.controlPanelGrid}>
            {/* Temperature */}
            {sensors.includes("Temperature") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Temperature:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="number"
                    value={latestData.temperature}
                    readOnly
                    className={styles.sensorInput}
                  />
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
                  <button
                    onClick={() => handleSetSensor("temperature")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {/* Humidity */}
            {sensors.includes("Humidity") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Humidity:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="number"
                    value={latestData.humidity}
                    readOnly
                    className={styles.sensorInput}
                  />
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
                  <button
                    onClick={() => handleSetSensor("humidity")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {/* Soil Moisture */}
            {sensors.includes("Soil Moisture") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Soil Moisture:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="number"
                    value={latestData.soilMoisture}
                    readOnly
                    className={styles.sensorInput}
                  />
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
                  <button
                    onClick={() => handleSetSensor("soilMoisture")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {/* Fans */}
            {sensors.includes("Fan 1") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Fan 1 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.fan1State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan1State"
                      value="true"
                      checked={editedData.fan1State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, fan1State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan1State"
                      value="false"
                      checked={editedData.fan1State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, fan1State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("fan1State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Fan 2") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Fan 2 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.fan2State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan2State"
                      value="true"
                      checked={editedData.fan2State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, fan2State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan2State"
                      value="false"
                      checked={editedData.fan2State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, fan2State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("fan2State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Fan 3") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Fan 3 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.fan3State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan3State"
                      value="true"
                      checked={editedData.fan3State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, fan3State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan3State"
                      value="false"
                      checked={editedData.fan3State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, fan3State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("fan3State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {/* Lights */}
            {sensors.includes("Light 1") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Light 1:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="number"
                    value={latestData.light1}
                    readOnly
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.light1}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, light1: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("light1")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>

                <div className={styles.rowLabel}>
                  <strong>Light 1 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.light1State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light1State"
                      value="true"
                      checked={editedData.light1State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, light1State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light1State"
                      value="false"
                      checked={editedData.light1State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, light1State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("light1State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Light 2") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Light 2:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="number"
                    value={latestData.light2}
                    readOnly
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.light2}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, light2: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("light2")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>

                <div className={styles.rowLabel}>
                  <strong>Light 2 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.light2State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light2State"
                      value="true"
                      checked={editedData.light2State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, light2State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light2State"
                      value="false"
                      checked={editedData.light2State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, light2State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("light2State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Light 3") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Light 3:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="number"
                    value={latestData.light3}
                    readOnly
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.light3}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, light3: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("light3")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>

                <div className={styles.rowLabel}>
                  <strong>Light 3 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.light3State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light3State"
                      value="true"
                      checked={editedData.light3State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, light3State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light3State"
                      value="false"
                      checked={editedData.light3State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, light3State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("light3State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {/* Humidifiers */}
            {sensors.includes("Humidifier 1") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Humidifier 1 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.humidifier1State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="humidifier1State"
                      value="true"
                      checked={editedData.humidifier1State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, humidifier1State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="humidifier1State"
                      value="false"
                      checked={editedData.humidifier1State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, humidifier1State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("humidifier1State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Humidifier 2") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Humidifier 2 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.humidifier2State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="humidifier2State"
                      value="true"
                      checked={editedData.humidifier2State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, humidifier2State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="humidifier2State"
                      value="false"
                      checked={editedData.humidifier2State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, humidifier2State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("humidifier2State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {sensors.includes("Humidifier 3") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Humidifier 3 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input
                    type="text"
                    value={latestData.humidifier3State ? "On" : "Off"}
                    readOnly
                    className={styles.sensorInput}
                  />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="humidifier3State"
                      value="true"
                      checked={editedData.humidifier3State === true}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, humidifier3State: true }))
                      }
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="humidifier3State"
                      value="false"
                      checked={editedData.humidifier3State === false}
                      onChange={() =>
                        setEditedData((prev) => ({ ...prev, humidifier3State: false }))
                      }
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("humidifier3State")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
            {/* Water Level */}
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
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.waterLevel}
                    onChange={(e) =>
                      setEditedData((prev) => ({ ...prev, waterLevel: e.target.value }))
                    }
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>%</span>
                </div>
                <div className={styles.rowSet}>
                  <button
                    onClick={() => handleSetSensor("waterLevel")}
                    className={styles.setButton}
                  >
                    Set
                  </button>
                </div>

                {/* Optional quick fill button */}
                <div className={styles.rowLabel}>
                  <strong>Auto Fill:</strong>
                </div>
                <div className={styles.rowButton}>
                  <button onClick={handleFillWater} className={styles.setButton}>
                    Fill to 100%
                  </button>
                </div>
                <div />
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: "20px" }}>
          <button onClick={handleSetAllSensors} className={styles.setButton}>
            Set All
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          AUTOMATION AREA
      ────────────────────────────────────────────────────────── */}
      <div className={styles.automationContainer}>
        <h3>Automations</h3>
        <p className={styles.automationPurpose}>
          <strong>Purpose of Automation</strong>
          <br />
          Automations let you perform actions (e.g., turn fan on/off, fill water) automatically based on specific conditions.
        </p>
        <div className={styles.automationTopSelect}>
          <label className={styles.automationSelectLabel}>Saved Automations:</label>
          <select value={selectedAutomationId} onChange={handleSelectAutomation} className={styles.automationDropdown}>
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
            onChange={(e) => {
              const newBoardType = e.target.value;
              setAutomationBoardType(newBoardType);
              handleAutomationFormChange("action", newBoardType === "NSCB" ? "addWater" : "turnFanOn");
            }}
            className={styles.automationDropdown}
          >
            <option value="NSCB">NSCB</option>
            <option value="HPCB">HPCB</option>
          </select>
        </div>
        <div className={styles.automationGrid4col}>
          <div className={styles.automationLeft}>
            <label className={styles.automationStep}>Name</label>
            <input
              type="text"
              className={styles.automationNameInput}
              value={automationForm.name}
              onChange={(e) => handleAutomationFormChange("name", e.target.value)}
            />
          </div>
          <div className={styles.automationMiddle}>
            <label className={styles.automationStep}>Type</label>
            <div className={styles.automationSelectBlock}>
              <select
                value={automationForm.type}
                onChange={(e) => handleAutomationFormChange("type", e.target.value)}
                className={styles.automationDropdown}
              >
                <option value="time-based">Time-Based</option>
                <option value="threshold-based">Threshold-Based</option>
                <option value="time-length-based">Time-Length-Based</option>
              </select>
            </div>
          </div>
          <div className={styles.automationRight}>
            {automationForm.type === "time-based" ? (
              <>
                <label className={styles.automationLabelMargin}>Date/Time</label>
                <input
                  type="datetime-local"
                  className={styles.automationDatetimeInput}
                  value={automationForm.dateTime}
                  onChange={(e) => handleAutomationFormChange("dateTime", e.target.value)}
                />
              </>
            ) : automationForm.type === "time-length-based" ? (
              <>
                <label className={styles.automationLabelMargin}>Time Length</label>
                <input
                  type="number"
                  className={styles.automationDatetimeInput}
                  value={automationForm.timeLength}
                  onChange={(e) => handleAutomationFormChange("timeLength", e.target.value)}
                />
                <select
                  className={`${styles.automationDropdown} ${styles.automationSelectMargin}`}
                  value={automationForm.timeUnit}
                  onChange={(e) => handleAutomationFormChange("timeUnit", e.target.value)}
                >
                  <option value="Second">Second</option>
                  <option value="Minute">Minute</option>
                  <option value="Hour">Hour</option>
                </select>
              </>
            ) : (
              <>
                <label className={styles.automationLabelMargin}>Sensor Field</label>
                <select
                  className={`${styles.automationDropdown} ${styles.automationSelectMargin}`}
                  value={automationForm.sensorField}
                  onChange={(e) => handleAutomationFormChange("sensorField", e.target.value)}
                >
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                  <option value="soilMoisture">Soil Moisture</option>
                  <option value="light">Light</option>
                  <option value="waterLevel">Water Level</option>
                </select>
                <label className={styles.automationLabelMargin}>Operator</label>
                <select
                  className={`${styles.automationDropdown} ${styles.automationSelectMargin}`}
                  value={automationForm.operator}
                  onChange={(e) => handleAutomationFormChange("operator", e.target.value)}
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
                  onChange={(e) => handleAutomationFormChange("thresholdValue", e.target.value)}
                />
              </>
            )}
          </div>
          <div className={styles.automationSaved}>
            <label>Action</label>
            <select
              className={styles.automationDropdown}
              value={automationForm.action}
              onChange={(e) => handleAutomationFormChange("action", e.target.value)}
            >
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
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
            <input
              type="checkbox"
              checked={automationForm.enabled}
              onChange={(e) => handleAutomationFormChange("enabled", e.target.checked)}
            />
          </div>
          <div className={styles.automationRightRepeat}>
            {automationForm.type === "time-based" && (
              <>
                <label className={styles.automationRepeatLabel}>Repeat</label>
                <select
                  className={styles.automationDropdownTime}
                  value={automationForm.repeatSchedule}
                  onChange={(e) => handleAutomationFormChange("repeatSchedule", e.target.value)}
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
        <div className={styles.automationExistingList}>
          <h4>Existing Automations</h4>
          {automations.length === 0 && <p>No automations found.</p>}
          {automations.map((auto) => {
            return (
              <div key={auto.id} className={styles.automationItemRow}>
                <div>
                  <strong>{computeAutomationLabel(auto)}</strong>
                </div>
                <div>
                  <button onClick={() => handleToggleEnabled(auto.id, auto.enabled)} className={`${styles.setButton} ${styles.automationToggleButton}`}>
                    Toggle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={handleClearAutomations} className={`${styles.setButton} ${styles.automationClearButton}`}>
          Clear Automations
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
