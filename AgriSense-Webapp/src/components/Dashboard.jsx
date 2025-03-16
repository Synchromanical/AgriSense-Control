// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import styles from "../Dashboard.module.css";

/** Utility to format numeric values to 1 decimal place */
function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

/**
 * Helper to produce a string timestamp (no fractional seconds),
 * e.g. "2025-02-02T12:30:00Z"
 */
function getTimestampString(date = new Date()) {
  const iso = date.toISOString();
  const [withoutMillis] = iso.split(".");
  return withoutMillis + "Z";
}

/**
 * Example function that calculates "next occurrence" 
 * for a time-based automation if you want that logic,
 * or you can omit this if you already have it.
 */
function computeNextOccurrence(automation) {
  if (automation.type !== "time-based" || !automation.enabled) return null;
  if (!automation.dateTime) return null;

  const baseDate = new Date(automation.dateTime);
  if (isNaN(baseDate.getTime())) return null;

  const now = new Date();

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  let next = new Date(baseDate);

  for (let i = 0; i < 50; i++) {
    if (next >= now) {
      return next;
    }
    if (automation.repeatSchedule === "none") {
      return null;
    } else if (automation.repeatSchedule === "daily") {
      next = addDays(next, 1);
    } else if (automation.repeatSchedule === "weekly") {
      next = addDays(next, 7);
    } else {
      return null;
    }
  }
  return null;
}

function Dashboard() {
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

  const [dashboardLogs, setDashboardLogs] = useState([]);
  // If you’re displaying upcoming automations, store them here
  const [upcomingAutomations, setUpcomingAutomations] = useState([]);

  // 1) Real-time sensorData
  useEffect(() => {
    const q = query(collection(db, "sensorData"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (docs.length === 0) {
        setLatestData({
          temperature: "",
          humidity: "",
          soilMoisture: "",
          light: "",
          waterLevel: "",
          lightState: false,
          fanState: false,
          timestamp: null,
        });
        setDashboardLogs([]);
        return;
      }

      // The last doc is the newest
      const newestDoc = docs[docs.length - 1];
      setLatestData({
        temperature: formatOneDecimal(newestDoc.temperature),
        humidity: formatOneDecimal(newestDoc.humidity),
        soilMoisture: formatOneDecimal(newestDoc.soilMoisture),
        light: formatOneDecimal(newestDoc.light),
        waterLevel: newestDoc.waterLevel ?? "",
        lightState: newestDoc.lightState ?? false,
        fanState: newestDoc.fanState ?? false,
        timestamp: newestDoc.timestamp,
      });

      // Build array of lines for logs
      const lines = [];
      docs.forEach((docData) => {
        let timeObj = new Date(0);
        if (typeof docData.timestamp === "string") {
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
          { label: "Fan State", value: docData.fanState },
        ];

        sensorFields.forEach((field) => {
          if (field.value !== undefined && field.value !== null) {
            lines.push({
              time: timeObj,
              timeDisplay,
              action: `Reading of ${field.label}: ${field.value}`,
            });
          }
        });
      });

      // lines[] is ascending. Give each line an ID
      lines.forEach((line, idx) => {
        line.id = idx + 1;
      });

      // Last 5 lines, reversed
      const last5 = lines.slice(-5).reverse();
      setDashboardLogs(last5);
    });

    return () => unsubscribe();
  }, []);

  // Simple Light On/Off example
  const handleLightStateChange = async (e) => {
    const val = e.target.value === "true";
    const newDoc = {
      temperature: parseFloat(latestData.temperature) || 0,
      humidity: parseFloat(latestData.humidity) || 0,
      soilMoisture: parseFloat(latestData.soilMoisture) || 0,
      light: parseFloat(latestData.light) || 0,
      waterLevel: parseFloat(latestData.waterLevel) || 0,
      lightState: val,
      fanState: latestData.fanState,
      timestamp: getTimestampString(),
    };
    try {
      await addDoc(collection(db, "sensorData"), newDoc);
    } catch (error) {
      console.error("Error changing lightState:", error);
    }
  };

  // 2) Optional: subscribe to automations & compute next occurrences
  useEffect(() => {
    // If you want to show upcoming automations on the dashboard
    import("firebase/firestore")
      .then(({ onSnapshot }) => {
        const unsub = onSnapshot(collection(db, "automations"), (snapshot) => {
          const docs = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          const upcoming = [];
          docs.forEach((auto) => {
            const next = computeNextOccurrence(auto);
            if (next) {
              upcoming.push({
                ...auto,
                nextOccurrence: next,
              });
            }
          });
          upcoming.sort((a, b) => a.nextOccurrence - b.nextOccurrence);
          const top3 = upcoming.slice(0, 3);
          setUpcomingAutomations(top3);
        });
        return unsub;
      })
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className={styles.content}>
      <h2>Dashboard</h2>

      {/* Left/Right: sensor data + logs */}
      <div className={styles.dashboardContainer}>
        {/* LEFT: LATEST SENSOR DATA */}
        <div className={styles.sensorDataContainer}>
          <div className={styles.sensorData}>
            <h3>Latest Sensor Data</h3>

            <div className={styles.sensorRow}>
              <div className={styles.sensorLabel}>
                <label>
                  <strong>Temperature:</strong>
                </label>
              </div>
              <div className={styles.sensorInputContainer}>
                <input
                  type="number"
                  value={latestData.temperature}
                  readOnly
                  className={styles.sensorInput}
                />
                <span>°C</span>
              </div>
            </div>

            <div className={styles.sensorRow}>
              <div className={styles.sensorLabel}>
                <label>
                  <strong>Humidity:</strong>
                </label>
              </div>
              <div className={styles.sensorInputContainer}>
                <input
                  type="number"
                  value={latestData.humidity}
                  readOnly
                  className={styles.sensorInput}
                />
                <span>%</span>
              </div>
            </div>

            <div className={styles.sensorRow}>
              <div className={styles.sensorLabel}>
                <label>
                  <strong>Soil Moisture:</strong>
                </label>
              </div>
              <div className={styles.sensorInputContainer}>
                <input
                  type="number"
                  value={latestData.soilMoisture}
                  readOnly
                  className={styles.sensorInput}
                />
                <span>%</span>
              </div>
            </div>

            <div className={styles.sensorRow}>
              <div className={styles.sensorLabel}>
                <label>
                  <strong>Water Level:</strong>
                </label>
              </div>
              <div className={styles.sensorInputContainer}>
                <input
                  type="number"
                  value={latestData.waterLevel}
                  readOnly
                  className={styles.sensorInput}
                />
                <span>%</span>
              </div>
            </div>

            <div className={styles.sensorRow}>
              <div className={styles.sensorLabel}>
                <label>
                  <strong>Light:</strong>
                </label>
              </div>
              <div className={styles.sensorInputContainer}>
                <input
                  type="number"
                  value={latestData.light}
                  readOnly
                  className={styles.sensorInput}
                />
                <span>lux</span>
              </div>
            </div>

            {/* Light State row with the radio group included in the second column */}
            <div className={styles.sensorRow}>
              <div className={styles.sensorLabel}>
                <label>
                  <strong>Light State:</strong>
                </label>
              </div>
              <div className={styles.sensorInputContainer}>
                <div className={styles.radioGroup}>
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
        </div>

        {/* RIGHT: Last 5 logs */}
        <div className={styles.dashboardLogsContainer}>
          <h3>Latest Logs</h3>
          <table className={styles.logsTable}>
            <thead>
              <tr>
                <th className={styles.logsTh}>ID</th>
                <th className={styles.logsTh}>Time</th>
                <th className={styles.logsTh}>Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboardLogs.length > 0 ? (
                dashboardLogs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.logsTd}>{log.id}</td>
                    <td className={styles.logsTd}>{log.timeDisplay}</td>
                    <td className={styles.logsTd}>{log.action}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={styles.logsTd} colSpan="3">
                    No logs available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW SECTION: Upcoming Automations */}
      <div className={styles.dashboardAutomationsContainer}>
        <h3>Upcoming Automations</h3>
        {upcomingAutomations.length === 0 ? (
          <p>No upcoming time-based automations.</p>
        ) : (
          <table className={styles.upcomingAutomationsTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Next Occurrence</th>
                <th>Repeat</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {upcomingAutomations.map((auto) => {
                const next = auto.nextOccurrence
                  ? auto.nextOccurrence.toLocaleString()
                  : "N/A";
                return (
                  <tr key={auto.id}>
                    <td>{auto.name}</td>
                    <td>{next}</td>
                    <td>{auto.repeatSchedule}</td>
                    <td>{auto.action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
