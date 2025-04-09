import React, { createContext, useContext, useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

/** Format a numeric value to 1 decimal place (return empty if NaN) */
function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

/** Convert a JS Date to the Firestore-like timestamp string (ISO 8601 with 'Z') */
function getTimestampString(date = new Date()) {
  const iso = date.toISOString();
  const [withoutMillis] = iso.split(".");
  return withoutMillis + "Z";
}

/** The shape of our entire Firestore store. */
const initialDataState = {
  // Real-time board readings
  gsmReadings: [],  // all docs from "GSMB"
  hpcbReadings: [], // all docs from "HPCB"
  nscbReadings: [], // all docs from "NSCB"

  // “latest” snapshot for easy display
  latest: {
    temperature: "",
    humidity: "",
    soilMoisture: "",

    // numeric lux
    light1: "",
    light2: "",
    light3: "",
    // boolean on/off
    light1State: false,
    light2State: false,
    light3State: false,

    fan1State: false,
    fan2State: false,
    fan3State: false,

    humidifier1State: false,
    humidifier2State: false,
    humidifier3State: false,

    waterLevel: "",
    nutrient1: "",
    nutrient2: "",

    timestamp: null,
  },

  // Automations
  automations: [],

  // Combined logs
  mergedLogs: [],
};

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [dataState, setDataState] = useState(initialDataState);

  // ─────────────────────────────────────────────────────────────
  //  1) SUBSCRIBE TO GSMB, HPCB, NSCB
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const subscribeTo = (collectionName, stateKey) => {
      const colRef = collection(db, collectionName);
      const q = query(colRef, orderBy("timestamp", "asc"));
      return onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setDataState((prev) => {
          const newState = { ...prev };
          newState[stateKey] = docs;
          return computeDerivedState(newState);
        });
      });
    };

    const unsubGSMB = subscribeTo("GSMB", "gsmReadings");
    const unsubHPCB = subscribeTo("HPCB", "hpcbReadings");
    const unsubNSCB = subscribeTo("NSCB", "nscbReadings");

    return () => {
      unsubGSMB();
      unsubHPCB();
      unsubNSCB();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  //  2) SUBSCRIBE TO AUTOMATIONS
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const colRef = collection(db, "automations");
    const unsub = onSnapshot(colRef, (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setDataState((prev) => {
        const newState = { ...prev, automations: docs };
        return computeDerivedState(newState);
      });
    });
    return () => unsub();
  }, []);

  // ─────────────────────────────────────────────────────────────
  //  3) COMPUTE “LATEST” + “MERGED LOGS”
  // ─────────────────────────────────────────────────────────────
  function computeDerivedState(newState) {
    const latestGSMB = getLatestDoc(newState.gsmReadings);
    const latestHPCB = getLatestDoc(newState.hpcbReadings);
    const latestNSCB = getLatestDoc(newState.nscbReadings);

    const combinedLatest = {
      temperature: latestGSMB ? formatOneDecimal(latestGSMB.temperature) : "",
      humidity: latestGSMB ? formatOneDecimal(latestGSMB.humidity) : "",
      soilMoisture: latestGSMB ? formatOneDecimal(latestGSMB.soilMoisture) : "",

      // numeric lux
      light1: latestHPCB?.light1 ? formatOneDecimal(latestHPCB.light1) : "",
      light2: latestHPCB?.light2 ? formatOneDecimal(latestHPCB.light2) : "",
      light3: latestHPCB?.light3 ? formatOneDecimal(latestHPCB.light3) : "",
      // on/off
      light1State: latestHPCB?.light1State ?? false,
      light2State: latestHPCB?.light2State ?? false,
      light3State: latestHPCB?.light3State ?? false,

      fan1State: latestHPCB?.fan1State ?? false,
      fan2State: latestHPCB?.fan2State ?? false,
      fan3State: latestHPCB?.fan3State ?? false,

      humidifier1State: latestHPCB?.humidifier1State ?? false,
      humidifier2State: latestHPCB?.humidifier2State ?? false,
      humidifier3State: latestHPCB?.humidifier3State ?? false,

      waterLevel: latestNSCB?.waterLevel
        ? formatOneDecimal(latestNSCB.waterLevel)
        : "",

      nutrient1: latestNSCB?.nutrient1
        ? formatOneDecimal(latestNSCB.nutrient1)
        : "",
      nutrient2: latestNSCB?.nutrient2
        ? formatOneDecimal(latestNSCB.nutrient2)
        : "",

      timestamp: combineLatestTimestamp(latestGSMB, latestHPCB, latestNSCB),
    };

    newState.latest = combinedLatest;
    newState.mergedLogs = buildMergedLogs(
      newState.gsmReadings,
      newState.hpcbReadings,
      newState.nscbReadings
    );
    return newState;
  }

  function getLatestDoc(docs) {
    if (!docs.length) return null;
    return docs.reduce((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return tA > tB ? a : b;
    });
  }

  function combineLatestTimestamp(g, h, n) {
    const times = [];
    if (g?.timestamp) times.push(new Date(g.timestamp).getTime());
    if (h?.timestamp) times.push(new Date(h.timestamp).getTime());
    if (n?.timestamp) times.push(new Date(n.timestamp).getTime());
    if (!times.length) return null;
    return new Date(Math.max(...times));
  }

  function buildMergedLogs(gsm, hpcb, nscb) {
    const lines = [];

    const processDocs = (docs, boardType) => {
      docs.forEach((d) => {
        const timeObj = parseTimestamp(d.timestamp);
        const timeDisplay = timeObj.toLocaleString();

        const sensorFields = [
          { label: "Temperature", value: d.temperature },
          { label: "Humidity", value: d.humidity },
          { label: "Soil Moisture", value: d.soilMoisture },
          { label: "Light 1 (lux)", value: d.light1 },
          { label: "Light 2 (lux)", value: d.light2 },
          { label: "Light 3 (lux)", value: d.light3 },
          { label: "Light 1 State", value: d.light1State },
          { label: "Light 2 State", value: d.light2State },
          { label: "Light 3 State", value: d.light3State },
          { label: "Fan 1 State", value: d.fan1State },
          { label: "Fan 2 State", value: d.fan2State },
          { label: "Fan 3 State", value: d.fan3State },
          { label: "Humidifier 1 State", value: d.humidifier1State },
          { label: "Humidifier 2 State", value: d.humidifier2State },
          { label: "Humidifier 3 State", value: d.humidifier3State },
          { label: "Water Level", value: d.waterLevel },
          { label: "Nutrient 1 Level", value: d.nutrient1 },
          { label: "Nutrient 2 Level", value: d.nutrient2 },
        ];

        sensorFields.forEach((field) => {
          if (
            field.value !== undefined &&
            field.value !== null &&
            field.value !== ""
          ) {
            lines.push({
              boardType,
              time: timeObj,
              timeDisplay,
              action: `Reading of ${field.label}: ${field.value}`,
            });
          }
        });
      });
    };

    processDocs(gsm, "GSMB");
    processDocs(hpcb, "HPCB");
    processDocs(nscb, "NSCB");

    lines.sort((a, b) => a.time - b.time);
    lines.forEach((line, idx) => {
      line.id = idx + 1;
    });
    return lines;
  }

  function parseTimestamp(ts) {
    if (!ts) return new Date(0);
    const parsed = new Date(ts);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  // ─────────────────────────────────────────────────────────────
  //  4) CREATE NEW READING (existing logic)
  // ─────────────────────────────────────────────────────────────
  async function createNewReading(fieldsToUpdate, activeSensors) {
    const boardsNeeded = new Set();
    activeSensors.forEach((sensorName) => {
      const lower = sensorName.toLowerCase();
      if (
        lower.includes("temperature") ||
        lower.includes("humidity") ||
        lower.includes("soil moisture")
      ) {
        boardsNeeded.add("GSMB");
      }
      if (
        sensorName.startsWith("Fan ") ||
        sensorName.startsWith("Light ") ||
        sensorName.startsWith("Humidifier ")
      ) {
        boardsNeeded.add("HPCB");
      }
      if (lower.includes("water") || lower.includes("nutrient")) {
        boardsNeeded.add("NSCB");
      }
    });

    const timestamp = getTimestampString();

    for (const board of boardsNeeded) {
      // Grab the latest doc to preserve existing values
      let latestDoc = null;
      if (board === "GSMB") {
        latestDoc = getLatestDoc(dataState.gsmReadings);
      } else if (board === "HPCB") {
        latestDoc = getLatestDoc(dataState.hpcbReadings);
      } else if (board === "NSCB") {
        latestDoc = getLatestDoc(dataState.nscbReadings);
      }

      let docData = latestDoc ? { ...latestDoc } : {};

      // Remove Firestore-specific fields
      delete docData.id;
      delete docData.timestamp;
      delete docData.boardType;

      // Set new doc's timestamp + board
      docData.timestamp = timestamp;
      docData.boardType = board;

      // GSMB fields
      if (board === "GSMB") {
        if (activeSensors.includes("Temperature") && fieldsToUpdate.hasOwnProperty("temperature")) {
          docData.temperature = parseFloat(fieldsToUpdate.temperature) || 0;
        }
        if (activeSensors.includes("Humidity") && fieldsToUpdate.hasOwnProperty("humidity")) {
          docData.humidity = parseFloat(fieldsToUpdate.humidity) || 0;
        }
        if (
          activeSensors.includes("Soil Moisture") &&
          fieldsToUpdate.hasOwnProperty("soilMoisture")
        ) {
          docData.soilMoisture = parseFloat(fieldsToUpdate.soilMoisture) || 0;
        }
      }

      // HPCB fields
      if (board === "HPCB") {
        // FANS
        if (activeSensors.includes("Fan 1") && fieldsToUpdate.hasOwnProperty("fan1State")) {
          docData.fan1State = fieldsToUpdate.fan1State;
        }
        if (activeSensors.includes("Fan 2") && fieldsToUpdate.hasOwnProperty("fan2State")) {
          docData.fan2State = fieldsToUpdate.fan2State;
        }
        if (activeSensors.includes("Fan 3") && fieldsToUpdate.hasOwnProperty("fan3State")) {
          docData.fan3State = fieldsToUpdate.fan3State;
        }

        // LIGHTS: numeric + boolean
        if (activeSensors.includes("Light 1")) {
          if (fieldsToUpdate.hasOwnProperty("light1")) {
            docData.light1 = parseFloat(fieldsToUpdate.light1) || 0;
          }
          if (fieldsToUpdate.hasOwnProperty("light1State")) {
            docData.light1State = fieldsToUpdate.light1State;
          }
        }
        if (activeSensors.includes("Light 2")) {
          if (fieldsToUpdate.hasOwnProperty("light2")) {
            docData.light2 = parseFloat(fieldsToUpdate.light2) || 0;
          }
          if (fieldsToUpdate.hasOwnProperty("light2State")) {
            docData.light2State = fieldsToUpdate.light2State;
          }
        }
        if (activeSensors.includes("Light 3")) {
          if (fieldsToUpdate.hasOwnProperty("light3")) {
            docData.light3 = parseFloat(fieldsToUpdate.light3) || 0;
          }
          if (fieldsToUpdate.hasOwnProperty("light3State")) {
            docData.light3State = fieldsToUpdate.light3State;
          }
        }

        // HUMIDIFIERS
        if (
          activeSensors.includes("Humidifier 1") &&
          fieldsToUpdate.hasOwnProperty("humidifier1State")
        ) {
          docData.humidifier1State = fieldsToUpdate.humidifier1State;
        }
        if (
          activeSensors.includes("Humidifier 2") &&
          fieldsToUpdate.hasOwnProperty("humidifier2State")
        ) {
          docData.humidifier2State = fieldsToUpdate.humidifier2State;
        }
        if (
          activeSensors.includes("Humidifier 3") &&
          fieldsToUpdate.hasOwnProperty("humidifier3State")
        ) {
          docData.humidifier3State = fieldsToUpdate.humidifier3State;
        }
      }

      // NSCB fields (water + nutrients)
      if (board === "NSCB") {
        if (activeSensors.includes("Water Level") && fieldsToUpdate.hasOwnProperty("waterLevel")) {
          docData.waterLevel = parseFloat(fieldsToUpdate.waterLevel) || 0;
        }
        if (
          activeSensors.includes("Nutrient 1 Level") &&
          fieldsToUpdate.hasOwnProperty("nutrient1")
        ) {
          docData.nutrient1 = parseFloat(fieldsToUpdate.nutrient1) || 0;
        }
        if (
          activeSensors.includes("Nutrient 2 Level") &&
          fieldsToUpdate.hasOwnProperty("nutrient2")
        ) {
          docData.nutrient2 = parseFloat(fieldsToUpdate.nutrient2) || 0;
        }
      }

      try {
        await addDoc(collection(db, board), docData);
      } catch (err) {
        console.error("Error creating new reading in", board, err);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  AUTOMATIONS: CREATE, UPDATE, DELETE, CLEAR
  // ─────────────────────────────────────────────────────────────

  /**
   * Utility: figure out a "portNumber" based on the action and the activeSensors.
   * For example, if action is "turnOnLight" and the user has "Light 2" in activeSensors,
   * then portNumber = 2, etc.
   */
  function getPortNumberForAction(action, instanceSensors) {
    // action values for HPCB are: "turnOnLight", "turnOnFan", "turnOnHumidifier"
    // We check which slot the user has (Light 1, Light 2, Light 3, etc.)
    if (action === "turnOnLight") {
      if (instanceSensors.includes("Light 1")) return 1;
      if (instanceSensors.includes("Light 2")) return 2;
      if (instanceSensors.includes("Light 3")) return 3;
    } else if (action === "turnOnFan") {
      if (instanceSensors.includes("Fan 1")) return 1;
      if (instanceSensors.includes("Fan 2")) return 2;
      if (instanceSensors.includes("Fan 3")) return 3;
    } else if (action === "turnOnHumidifier") {
      if (instanceSensors.includes("Humidifier 1")) return 1;
      if (instanceSensors.includes("Humidifier 2")) return 2;
      if (instanceSensors.includes("Humidifier 3")) return 3;
    }
    // If not found, or no matching sensor, return null
    return null;
  }

  // ADDED: helper to map boardType => numeric node
  function getNodeNumberForBoardType(boardType) {
    if (boardType === "GSMB") return 1;
    if (boardType === "HPCB") return 2;
    if (boardType === "NSCB") return 3;
    return 0;
  }

  /**
   * Create an automation document in Firestore with all required fields.
   */
  async function createAutomation(payload, instanceSensors) {
    try {
      const docData = buildAutomationDocData(payload, instanceSensors);
      const colRef = collection(db, "automations");
      const docRef = await addDoc(colRef, docData);
      return docRef.id;
    } catch (error) {
      console.error("Error creating automation:", error);
      return null;
    }
  }

  /**
   * Update an existing automation document by ID.
   */
  async function updateAutomation(id, payload, instanceSensors) {
    try {
      const docData = buildAutomationDocData(payload, instanceSensors);
      const docRef = doc(db, "automations", id);
      await updateDoc(docRef, docData);
    } catch (error) {
      console.error("Error updating automation:", error);
    }
  }

  /**
   * Delete an automation document by ID.
   */
  async function deleteAutomation(id) {
    try {
      const docRef = doc(db, "automations", id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting automation:", error);
    }
  }

  /**
   * Clear all documents in the "automations" collection.
   */
  async function clearAllAutomations() {
    try {
      const colRef = collection(db, "automations");
      const snapshot = await getDocs(colRef);
      const batchDeletes = [];
      snapshot.forEach((docSnap) => {
        batchDeletes.push(deleteDoc(doc(db, "automations", docSnap.id)));
      });
      await Promise.all(batchDeletes);
    } catch (error) {
      console.error("Error clearing all automations:", error);
    }
  }

  /**
   * A helper that constructs the Firestore doc for an automation
   * based on boardType & type. Adheres to the required fields:
   *
   * - For HPCB:
   *   • Time-Based:        boardType, name, type, timestamp, timeLength, timeLengthType, action, enabled, repeat, portNumber
   *   • Time-Length-Based: boardType, name, type, timeLength, timeLengthType, action, enabled, repeat, portNumber
   *   • Threshold-Based:   boardType, name, type, sensorField, operator, thresholdNumber, timeLength, timeLengthType, action, enabled, repeat, portNumber
   *
   * - For NSCB:
   *   • Time-Based:        boardType, name, type, timestamp, timeLength, timeLengthType, action, enabled, repeat, volume
   *   • Time-Length-Based: boardType, name, type, timeLength, timeLengthType, action, enabled, repeat, volume
   *   • Threshold-Based:   boardType, name, type, sensorField, operator, thresholdNumber, timeLength, timeLengthType, action, enabled, repeat, volume
   */
  function buildAutomationDocData(payload, instanceSensors) {
    const {
      boardType,
      name,
      type,
      dateTime,
      timeLength,
      timeUnit,
      sensorField,
      operator,
      thresholdValue,
      action,
      enabled,
      repeatSchedule,
      volumeMl,

      // ADDED: instanceNumber passed in from ControlPanel
      instanceNumber,
    } = payload;

    const docData = {
      boardType,
      name: name || "",
      type,
      enabled: enabled ?? true,
      repeat: repeatSchedule || "none",
      action,
    };

    // ADDED: instanceNumber and nodeNumber
    docData.instanceNumber = parseInt(instanceNumber) || 1;
    docData.nodeNumber = getNodeNumberForBoardType(boardType);

    // For time-based or threshold-based => we store timeLength/timeLengthType if relevant
    if (type === "time-based") {
      docData.timestamp = dateTime
        ? new Date(dateTime).toISOString()
        : getTimestampString(); // fallback if none
      docData.timeLength = parseInt(timeLength) || 0;
      docData.timeLengthType = timeUnit || "Second";
    } else if (type === "time-length-based") {
      docData.timeLength = parseInt(timeLength) || 0;
      docData.timeLengthType = timeUnit || "Second";
    } else if (type === "threshold-based") {
      docData.sensorField = sensorField || "";
      docData.operator = operator || ">";
      docData.thresholdNumber = parseFloat(thresholdValue) || 0;
      docData.timeLength = parseInt(timeLength) || 0;
      docData.timeLengthType = timeUnit || "Second";
    }

    // Next, handle boardType-specific fields
    if (boardType === "HPCB") {
      const portNumber = getPortNumberForAction(action, instanceSensors);
      docData.portNumber = portNumber !== null ? portNumber : 0;
    } else if (boardType === "NSCB") {
      docData.volume = parseFloat(volumeMl) || 0;
    }

    return docData;
  }

  // LOGS
  async function importLogs(jsonItems, activeSensors) {
    // Implementation omitted or optional
  }
  async function clearLogs(activeSensors) {
    // Implementation omitted or optional
  }

  const value = {
    dataState,
    createNewReading,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    clearAllAutomations,
    importLogs,
    clearLogs,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useDataContext = () => {
  return useContext(DataContext);
};
