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

    light1: "",
    light2: "",
    light3: "",
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

    // **Add these two so the dashboard can show them**
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

      light1: latestHPCB?.light1 ? formatOneDecimal(latestHPCB.light1) : "",
      light2: latestHPCB?.light2 ? formatOneDecimal(latestHPCB.light2) : "",
      light3: latestHPCB?.light3 ? formatOneDecimal(latestHPCB.light3) : "",
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

      // **Pull from the latest NSCB doc.** Use formatOneDecimal if you want 1 decimal.
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

        // **Include your nutrient1, nutrient2, etc.** 
        const sensorFields = [
          { label: "Temperature", value: d.temperature },
          { label: "Humidity", value: d.humidity },
          { label: "Soil Moisture", value: d.soilMoisture },
          { label: "Light 1", value: d.light1 },
          { label: "Light 2", value: d.light2 },
          { label: "Light 3", value: d.light3 },
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

          // **Here are the new ones:**
          { label: "Nutrient 1 Level", value: d.nutrient1 },
          { label: "Nutrient 2 Level", value: d.nutrient2 },
        ];

        sensorFields.forEach((field) => {
          if (field.value !== undefined && field.value !== null && field.value !== "") {
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
  //  4) CREATE NEW READING (Copy-latest approach) 
  // ─────────────────────────────────────────────────────────────
  async function createNewReading(fieldsToUpdate, activeSensors) {
    const boardsNeeded = new Set();
    activeSensors.forEach((sensorName) => {
      const lower = sensorName.toLowerCase();
      if (["temperature", "humidity", "soil moisture"].some((w) => lower.includes(w))) {
        boardsNeeded.add("GSMB");
      }
      if (
        sensorName.startsWith("Fan ") ||
        sensorName.startsWith("Light ") ||
        sensorName.startsWith("Humidifier ")
      ) {
        boardsNeeded.add("HPCB");
      }
      // **Nutrients or water go to NSCB** 
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
        if (
          activeSensors.includes("Temperature") &&
          fieldsToUpdate.hasOwnProperty("temperature")
        ) {
          docData.temperature = parseFloat(fieldsToUpdate.temperature) || 0;
        }
        if (
          activeSensors.includes("Humidity") &&
          fieldsToUpdate.hasOwnProperty("humidity")
        ) {
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
        // Fans
        if (
          activeSensors.includes("Fan 1") &&
          fieldsToUpdate.hasOwnProperty("fan1State")
        ) {
          docData.fan1State = fieldsToUpdate.fan1State;
        }
        if (
          activeSensors.includes("Fan 2") &&
          fieldsToUpdate.hasOwnProperty("fan2State")
        ) {
          docData.fan2State = fieldsToUpdate.fan2State;
        }
        if (
          activeSensors.includes("Fan 3") &&
          fieldsToUpdate.hasOwnProperty("fan3State")
        ) {
          docData.fan3State = fieldsToUpdate.fan3State;
        }

        // Lights
        if (
          activeSensors.includes("Light 1") &&
          fieldsToUpdate.hasOwnProperty("light1State")
        ) {
          docData.light1State = fieldsToUpdate.light1State;
        }
        if (
          activeSensors.includes("Light 2") &&
          fieldsToUpdate.hasOwnProperty("light2State")
        ) {
          docData.light2State = fieldsToUpdate.light2State;
        }
        if (
          activeSensors.includes("Light 3") &&
          fieldsToUpdate.hasOwnProperty("light3State")
        ) {
          docData.light3State = fieldsToUpdate.light3State;
        }

        // Humidifiers
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
        if (
          activeSensors.includes("Water Level") &&
          fieldsToUpdate.hasOwnProperty("waterLevel")
        ) {
          docData.waterLevel = parseFloat(fieldsToUpdate.waterLevel) || 0;
        }
        // **Uncomment or add these lines for nutrients:**
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

  // AUTOMATIONS
  async function createAutomation(payload) { /* ... */ }
  async function updateAutomation(id, payload) { /* ... */ }
  async function deleteAutomation(id) { /* ... */ }
  async function clearAllAutomations() { /* ... */ }

  // LOGS
  async function importLogs(jsonItems, activeSensors) { /* ... */ }
  async function clearLogs(activeSensors) { /* ... */ }

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
