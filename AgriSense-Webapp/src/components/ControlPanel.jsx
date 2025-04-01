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
  (You may need to extend this mapping if you want to fully support individual fan/light fields.)
*/
const sensorMapping = {
  temperature: { collection: "GSMB", field: "temperature" },
  humidity: { collection: "GSMB", field: "humidity" },
  soilmoisture: { collection: "GSMB", field: "soilMoisture" },
  waterlevel: { collection: "NSCB", field: "waterLevel" },
};

const ControlPanel = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];
  
  // Added keys for individual HPCB sensors
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
    waterLevel: "",
    timestamp: null,
  });
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
  });
  const [automations, setAutomations] = useState([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState("");

  // Board type for automations – "NSCB" or "HPCB"
  const [automationBoardType, setAutomationBoardType] = useState("NSCB");

  // Automation form state
  const [automationForm, setAutomationForm] = useState({
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

  // Subscribe to sensor updates (for simplicity, this example adds extra field names when an HPCB sensor is active)
  useEffect(() => {
    const collectionsNeeded = {};
    sensors.forEach((sensorName) => {
      // Use sensorMapping for GSMB and NSCB sensors
      const key = sensorName.toLowerCase().replace(/\s/g, "");
      if (sensorMapping[key]) {
        const colName = sensorMapping[key].collection;
        if (!collectionsNeeded[colName]) {
          collectionsNeeded[colName] = new Set();
        }
        collectionsNeeded[colName].add(sensorMapping[key].field);
      }
      // For HPCB sensors, add fields for individual sensors
      if (sensorName.startsWith("Light")) {
        const [ , number] = sensorName.split(" ");
        collectionsNeeded["HPCB"] = collectionsNeeded["HPCB"] || new Set();
        collectionsNeeded["HPCB"].add(`light${number}`);
        collectionsNeeded["HPCB"].add(`light${number}State`);
      }
      if (sensorName.startsWith("Fan")) {
        const [ , number] = sensorName.split(" ");
        collectionsNeeded["HPCB"] = collectionsNeeded["HPCB"] || new Set();
        collectionsNeeded["HPCB"].add(`fan${number}State`);
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

  async function createNewReading(updatedFields) {
    const activeBoards = new Set();
    sensors.forEach((sensorName) => {
      const key = sensorName.toLowerCase().replace(/\s/g, "");
      if (sensorMapping[key]) {
        activeBoards.add(sensorMapping[key].collection);
      }
      if (sensorName.startsWith("Light") || sensorName.startsWith("Fan")) {
        activeBoards.add("HPCB");
      }
    });
    const timestamp = getTimestampString();
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
        // Set individual HPCB sensor fields
        docData.light1 =
          updatedFields.light1 !== undefined
            ? updatedFields.light1
            : latestData.light1 !== "" ? latestData.light1 : 0;
        docData.light2 =
          updatedFields.light2 !== undefined
            ? updatedFields.light2
            : latestData.light2 !== "" ? latestData.light2 : 0;
        docData.light3 =
          updatedFields.light3 !== undefined
            ? updatedFields.light3
            : latestData.light3 !== "" ? latestData.light3 : 0;
        docData.light1State =
          updatedFields.light1State !== undefined
            ? updatedFields.light1State
            : typeof latestData.light1State === "boolean" ? latestData.light1State : false;
        docData.light2State =
          updatedFields.light2State !== undefined
            ? updatedFields.light2State
            : typeof latestData.light2State === "boolean" ? latestData.light2State : false;
        docData.light3State =
          updatedFields.light3State !== undefined
            ? updatedFields.light3State
            : typeof latestData.light3State === "boolean" ? latestData.light3State : false;
        docData.fan1State =
          updatedFields.fan1State !== undefined
            ? updatedFields.fan1State
            : typeof latestData.fan1State === "boolean" ? latestData.fan1State : false;
        docData.fan2State =
          updatedFields.fan2State !== undefined
            ? updatedFields.fan2State
            : typeof latestData.fan2State === "boolean" ? latestData.fan2State : false;
        docData.fan3State =
          updatedFields.fan3State !== undefined
            ? updatedFields.fan3State
            : typeof latestData.fan3State === "boolean" ? latestData.fan3State : false;
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
    updateObj.light1 = editedData.light1;
    updateObj.light2 = editedData.light2;
    updateObj.light3 = editedData.light3;
    updateObj.light1State = editedData.light1State;
    updateObj.light2State = editedData.light2State;
    updateObj.light3State = editedData.light3State;
    updateObj.fan1State = editedData.fan1State;
    updateObj.fan2State = editedData.fan2State;
    updateObj.fan3State = editedData.fan3State;
    if (editedData.waterLevel !== undefined) updateObj.waterLevel = editedData.waterLevel;
    await createNewReading(updateObj);
  };

  const handleFillWater = async () => {
    await createNewReading({ waterLevel: 100 });
  };

  // Helper to map action based on board type.
  const getStoredAction = () => {
    if (automationBoardType === "NSCB") {
      if (automationForm.action === "addWater") return "water";
      if (automationForm.action === "addNutrient") return "nutrient";
    } else if (automationBoardType === "HPCB") {
      if (automationForm.action === "turnFanOn") return "fan";
      if (automationForm.action === "turnLightOn") return "light";
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
        payload.timeLength = automationForm.timeLength ? parseFloat(automationForm.timeLength) : 0;
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

  const handleSelectAutomation = (e) => {
    const id = e.target.value;
    setSelectedAutomationId(id);
    if (!id) {
      resetAutomationForm();
      return;
    }
    const found = automations.find((a) => a.id === id);
    if (found) {
      setAutomationForm({
        name: found.name ?? "",
        type: found.type ?? "time-based",
        enabled: typeof found.enabled === "boolean" ? found.enabled : true,
        dateTime: found.dateTime ?? "",
        sensorField: found.sensorField ?? "temperature",
        operator: found.operator ?? ">",
        thresholdValue: found.thresholdValue ? found.thresholdValue.toString() : "",
        action: found.action ?? (automationBoardType === "NSCB" ? "addWater" : "turnFanOn"),
        timeLength: found.timeLength ? found.timeLength.toString() : "",
        timeUnit: found.timeLengthType
          ? found.timeLengthType.charAt(0).toUpperCase() + found.timeLengthType.slice(1)
          : "Second",
      });
    }
  };

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
        payload.timeLength = automationForm.timeLength ? parseFloat(automationForm.timeLength) : 0;
        payload.timeLengthType = automationForm.timeUnit.toLowerCase();
      }
      const docRef = doc(db, "automations", selectedAutomationId);
      await updateDoc(docRef, payload);
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
      resetAutomationForm();
    } catch (error) {
      console.error("Error clearing automations:", error);
    }
  };

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

  const actionOptions =
    automationBoardType === "NSCB"
      ? [
          { value: "addWater", label: "Add Water" },
          { value: "addNutrient", label: "Add Nutrient" },
        ]
      : [
          { value: "turnFanOn", label: "Turn Fan On" },
          { value: "turnLightOn", label: "Turn Light On" },
        ];

  const computeAutomationLabel = (auto) => {
    return `${auto.name} (${auto.type})`;
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
                    onChange={(e) => setEditedData((prev) => ({ ...prev, temperature: e.target.value }))}
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
                    onChange={(e) => setEditedData((prev) => ({ ...prev, humidity: e.target.value }))}
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
                    onChange={(e) => setEditedData((prev) => ({ ...prev, soilMoisture: e.target.value }))}
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
            {/* Fan Controls */}
            {sensors.includes("Fan 1") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Fan 1 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="text" value={latestData.fan1State ? "On" : "Off"} readOnly className={styles.sensorInput} />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan1State"
                      value="true"
                      checked={editedData.fan1State === true}
                      onChange={() => setEditedData((prev) => ({ ...prev, fan1State: true }))}
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan1State"
                      value="false"
                      checked={editedData.fan1State === false}
                      onChange={() => setEditedData((prev) => ({ ...prev, fan1State: false }))}
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("fan1State")} className={styles.setButton}>
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
                  <input type="text" value={latestData.fan2State ? "On" : "Off"} readOnly className={styles.sensorInput} />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan2State"
                      value="true"
                      checked={editedData.fan2State === true}
                      onChange={() => setEditedData((prev) => ({ ...prev, fan2State: true }))}
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan2State"
                      value="false"
                      checked={editedData.fan2State === false}
                      onChange={() => setEditedData((prev) => ({ ...prev, fan2State: false }))}
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("fan2State")} className={styles.setButton}>
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
                  <input type="text" value={latestData.fan3State ? "On" : "Off"} readOnly className={styles.sensorInput} />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan3State"
                      value="true"
                      checked={editedData.fan3State === true}
                      onChange={() => setEditedData((prev) => ({ ...prev, fan3State: true }))}
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="fan3State"
                      value="false"
                      checked={editedData.fan3State === false}
                      onChange={() => setEditedData((prev) => ({ ...prev, fan3State: false }))}
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("fan3State")} className={styles.setButton}>
                    Set
                  </button>
                </div>
              </>
            )}
            {/* Light Controls */}
            {sensors.includes("Light 1") && (
              <>
                <div className={styles.rowLabel}>
                  <strong>Light 1:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="number" value={latestData.light1} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.light1}
                    onChange={(e) => setEditedData((prev) => ({ ...prev, light1: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("light1")} className={styles.setButton}>
                    Set
                  </button>
                </div>
                <div className={styles.rowLabel}>
                  <strong>Light 1 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="text" value={latestData.light1State ? "On" : "Off"} readOnly className={styles.sensorInput} />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light1State"
                      value="true"
                      checked={editedData.light1State === true}
                      onChange={() => setEditedData((prev) => ({ ...prev, light1State: true }))}
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light1State"
                      value="false"
                      checked={editedData.light1State === false}
                      onChange={() => setEditedData((prev) => ({ ...prev, light1State: false }))}
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("light1State")} className={styles.setButton}>
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
                  <input type="number" value={latestData.light2} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.light2}
                    onChange={(e) => setEditedData((prev) => ({ ...prev, light2: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("light2")} className={styles.setButton}>
                    Set
                  </button>
                </div>
                <div className={styles.rowLabel}>
                  <strong>Light 2 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="text" value={latestData.light2State ? "On" : "Off"} readOnly className={styles.sensorInput} />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light2State"
                      value="true"
                      checked={editedData.light2State === true}
                      onChange={() => setEditedData((prev) => ({ ...prev, light2State: true }))}
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light2State"
                      value="false"
                      checked={editedData.light2State === false}
                      onChange={() => setEditedData((prev) => ({ ...prev, light2State: false }))}
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("light2State")} className={styles.setButton}>
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
                  <input type="number" value={latestData.light3} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowEdited}>
                  <input
                    type="number"
                    value={editedData.light3}
                    onChange={(e) => setEditedData((prev) => ({ ...prev, light3: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    className={styles.sensorInput}
                  />
                  <span className={styles.unit}>lux</span>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("light3")} className={styles.setButton}>
                    Set
                  </button>
                </div>
                <div className={styles.rowLabel}>
                  <strong>Light 3 State:</strong>
                </div>
                <div className={styles.rowLatest}>
                  <input type="text" value={latestData.light3State ? "On" : "Off"} readOnly className={styles.sensorInput} />
                </div>
                <div className={styles.rowButton}>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light3State"
                      value="true"
                      checked={editedData.light3State === true}
                      onChange={() => setEditedData((prev) => ({ ...prev, light3State: true }))}
                    />
                    On
                  </label>
                  <label className={styles.automationRadioLabel}>
                    <input
                      type="radio"
                      name="light3State"
                      value="false"
                      checked={editedData.light3State === false}
                      onChange={() => setEditedData((prev) => ({ ...prev, light3State: false }))}
                    />
                    Off
                  </label>
                </div>
                <div className={styles.rowSet}>
                  <button onClick={() => handleSetSensor("light3State")} className={styles.setButton}>
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
                  <input type="number" value={latestData.waterLevel} readOnly className={styles.sensorInput} />
                  <span className={styles.unit}>%</span>
                </div>
                <div className={styles.rowButton}>
                  <button onClick={handleFillWater} className={styles.setButton}>
                    Fill Water
                  </button>
                </div>
                <div className={styles.rowSet}></div>
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
