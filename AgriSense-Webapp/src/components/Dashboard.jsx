import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig";

/** Utility to format numeric values to 1 decimal place */
function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

/** 
 * Helper to produce a string "YYYY-MM-DDTHH:mm:ssZ" 
 * without milliseconds.
 */
function getTimestampString(date = new Date()) {
  // Example output: "2025-02-02T12:30:00Z"
  const iso = date.toISOString();       // e.g. "2025-02-02T12:30:00.123Z"
  const [dayAndTime] = iso.split(".");  // "2025-02-02T12:30:00"
  return dayAndTime + "Z";             // "2025-02-02T12:30:00Z"
}

function Dashboard() {
  /** State for the single "latest" document’s fields (left column) */
  const [latestData, setLatestData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light: "",
    waterLevel: "",
    lightState: false,
    timestamp: null,
  });

  /** State for all sensor docs => from which we build the logs (right column) */
  const [allDocs, setAllDocs] = useState([]);

  /** State for the final 5 logs we display (each sensor field = separate line) */
  const [dashboardLogs, setDashboardLogs] = useState([]);

  useEffect(() => {
    /**
     * Real-time subscription to entire sensorData, ordered ascending by timestamp.
     * We'll store them in `allDocs` so we can keep building the logs array.
     */
    const q = query(collection(db, "sensorData"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Convert Firestore docs into a simple array
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAllDocs(docs);

      if (docs.length === 0) {
        // If no documents, clear out everything
        setLatestData({
          temperature: "",
          humidity: "",
          soilMoisture: "",
          light: "",
          waterLevel: "",
          lightState: false,
          timestamp: null,
        });
        setDashboardLogs([]);
        return;
      }

      // 1) The last doc in ascending order is actually the newest
      const newestDoc = docs[docs.length - 1];
      setLatestData({
        temperature: formatOneDecimal(newestDoc.temperature),
        humidity: formatOneDecimal(newestDoc.humidity),
        soilMoisture: formatOneDecimal(newestDoc.soilMoisture),
        light: formatOneDecimal(newestDoc.light),
        waterLevel: newestDoc.waterLevel ?? "",
        lightState: newestDoc.lightState ?? false,
        timestamp: newestDoc.timestamp,
      });

      // 2) Build an array of "lines" for logs,
      //    each doc => multiple lines
      const lines = [];
      docs.forEach((docData) => {
        // The 'timestamp' is stored as a string in the new approach
        // Attempt to parse it as a Date so we can sort/format easily
        let timeObj = new Date(0); // fallback
        if (typeof docData.timestamp === "string") {
          // e.g. "2025-02-02T12:30:00Z"
          const parsed = new Date(docData.timestamp);
          if (!isNaN(parsed.getTime())) {
            timeObj = parsed;
          }
        }

        const timeDisplay = timeObj.toLocaleString();

        const sensorFields = [
          { label: "Temperature", value: docData.temperature },
          { label: "Humidity", value: docData.humidity },
          { label: "Soil Moisture", value: docData.soilMoisture },
          { label: "Light", value: docData.light },
          { label: "Water Level", value: docData.waterLevel },
          { label: "Light State", value: docData.lightState },
        ];

        sensorFields.forEach((field) => {
          if (field.value !== undefined && field.value !== null) {
            lines.push({
              // We'll assign an ID after building the array
              time: timeObj,
              timeDisplay,
              action: `Reading of ${field.label}: ${field.value}`,
            });
          }
        });
      });

      // 3) lines[] is in ascending order (earliest to latest).
      lines.forEach((line, idx) => {
        line.id = idx + 1;
      });

      // 4) Slice out the last 5 lines (the newest 5),
      //    then reverse them so the newest line appears first.
      const last5 = lines.slice(-5).reverse();
      setDashboardLogs(last5);
    });

    return () => unsubscribe();
  }, []);

  /** 
   * Creates a new reading with waterLevel=100 
   * and a string-based timestamp.
   */
  const fillWater = async () => {
    const newDoc = {
      temperature: parseFloat(latestData.temperature) || 0,
      humidity: parseFloat(latestData.humidity) || 0,
      soilMoisture: parseFloat(latestData.soilMoisture) || 0,
      light: parseFloat(latestData.light) || 0,
      waterLevel: 100,
      lightState: latestData.lightState,
      timestamp: getTimestampString(),  // e.g. "2025-02-02T12:30:00Z"
    };

    try {
      await addDoc(collection(db, "sensorData"), newDoc);
    } catch (error) {
      console.error("Error creating new reading:", error);
    }
  };

  /**
   * Updates lightState by creating a new doc with the chosen boolean value.
   */
  const handleLightStateChange = async (e) => {
    const val = e.target.value === "true"; // "on" -> true, "off" -> false
    const newDoc = {
      temperature: parseFloat(latestData.temperature) || 0,
      humidity: parseFloat(latestData.humidity) || 0,
      soilMoisture: parseFloat(latestData.soilMoisture) || 0,
      light: parseFloat(latestData.light) || 0,
      waterLevel: parseFloat(latestData.waterLevel) || 0,
      lightState: val,
      timestamp: getTimestampString(),
    };

    try {
      await addDoc(collection(db, "sensorData"), newDoc);
    } catch (error) {
      console.error("Error changing lightState:", error);
    }
  };

  return (
    <div className="content">
      <h2>Dashboard</h2>
      <div className="dashboard-container">
        {/* LEFT: LATEST SENSOR DATA */}
        <div className="sensor-data-container">
          <div className="sensor-data">
            <h3>Latest Sensor Data</h3>
            <div className="sensor-row">
              <label><strong>Temperature:</strong></label>
              <input
                type="number"
                value={latestData.temperature}
                readOnly
                className="sensor-input"
              />{" "}
              °C
            </div>
            <div className="sensor-row">
              <label><strong>Humidity:</strong></label>
              <input
                type="number"
                value={latestData.humidity}
                readOnly
                className="sensor-input"
              />{" "}
              %
            </div>
            <div className="sensor-row">
              <label><strong>Soil Moisture:</strong></label>
              <input
                type="number"
                value={latestData.soilMoisture}
                readOnly
                className="sensor-input"
              />{" "}
              %
            </div>
            <div className="sensor-row">
              <label><strong>Water Level:</strong></label>
              <input
                type="number"
                value={latestData.waterLevel}
                readOnly
                className="sensor-input"
              />{" "}
              %
              <button onClick={fillWater} className="fill-water-button">
                Fill Water
              </button>
            </div>
            <div className="sensor-row">
              <label><strong>Light:</strong></label>
              <input
                type="number"
                value={latestData.light}
                readOnly
                className="sensor-input"
              />{" "}
              lux
            </div>
            <div className="sensor-row">
              <label><strong>Light State:</strong></label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="lightState"
                    value="true"
                    checked={latestData.lightState === true}
                    onChange={handleLightStateChange}
                  />
                  On
                </label>
                <label>
                  <input
                    type="radio"
                    name="lightState"
                    value="false"
                    checked={latestData.lightState === false}
                    onChange={handleLightStateChange}
                  />
                  Off
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: LATEST FIVE LOGS (EACH FIELD AS ITS OWN LINE) */}
        <div className="dashboard-logs-container">
          <h3>Latest Logs</h3>
          <table className="logs-table">
            <thead>
              <tr>
                <th className="logs-th">ID</th>
                <th className="logs-th">Time</th>
                <th className="logs-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboardLogs.length > 0 ? (
                dashboardLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="logs-td">{log.id}</td>
                    <td className="logs-td">{log.timeDisplay}</td>
                    <td className="logs-td">{log.action}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="logs-td" colSpan="3">
                    No logs available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
