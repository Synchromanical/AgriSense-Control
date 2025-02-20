// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

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
 * Compute the next occurrence date for a time-based automation,
 * taking into account repeatSchedule. Returns `null` if there's
 * no upcoming occurrence (e.g. past date with no repeat).
 */
function computeNextOccurrence(automation) {
  // Only handle time-based & enabled
  if (automation.type !== "time-based" || !automation.enabled) return null;

  // Must have a valid dateTime
  if (!automation.dateTime) return null;
  const baseDate = new Date(automation.dateTime);
  if (isNaN(baseDate.getTime())) return null;

  const now = new Date();

  // Local helper to add days
  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  let next = new Date(baseDate);

  // Up to 50 iterations as a safeguard (to avoid infinite loops)
  for (let i = 0; i < 50; i++) {
    if (next >= now) {
      // Found a future date/time
      return next;
    }

    // If next < now, handle repeats
    if (automation.repeatSchedule === "none") {
      // No further repeats
      return null;
    } else if (automation.repeatSchedule === "daily") {
      next = addDays(next, 1);
    } else if (automation.repeatSchedule === "weekly") {
      next = addDays(next, 7);
    } else {
      // Unrecognized repeat type
      return null;
    }
  }
  // If we somehow never found a future date
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

  // -- New: store the top 3 upcoming automations
  const [upcomingAutomations, setUpcomingAutomations] = useState([]);

  useEffect(() => {
    // Real-time subscription to entire sensorData, ordered ascending
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

  // Only a simple Light On/Off example
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

  // ----------------------------------------------------------------
  // NEW: Subscribe to automations and compute top 3 upcoming
  // ----------------------------------------------------------------
  useEffect(() => {
    const automationsRef = collection(db, "automations");
    const unsub = onSnapshot(automationsRef, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Filter time-based, enabled, find nextOccurrence
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

      // Sort by nextOccurrence ascending
      upcoming.sort((a, b) => a.nextOccurrence - b.nextOccurrence);

      // Only take first 3
      const top3 = upcoming.slice(0, 3);

      setUpcomingAutomations(top3);
    });

    return () => unsub();
  }, []);

  return (
    <div className="content">
      <h2>Dashboard</h2>
      <div className="dashboard-container">
        {/* LEFT: LATEST SENSOR DATA */}
        <div className="sensor-data-container">
          <div className="sensor-data">
            <h3>Latest Sensor Data</h3>

            <div className="sensor-row">
              <label>
                <strong>Temperature:</strong>
              </label>
              <input
                type="number"
                value={latestData.temperature}
                readOnly
                className="sensor-input"
              />
              °C
            </div>

            <div className="sensor-row">
              <label>
                <strong>Humidity:</strong>
              </label>
              <input
                type="number"
                value={latestData.humidity}
                readOnly
                className="sensor-input"
              />
              %
            </div>

            <div className="sensor-row">
              <label>
                <strong>Soil Moisture:</strong>
              </label>
              <input
                type="number"
                value={latestData.soilMoisture}
                readOnly
                className="sensor-input"
              />
              %
            </div>

            <div className="sensor-row">
              <label>
                <strong>Water Level:</strong>
              </label>
              <input
                type="number"
                value={latestData.waterLevel}
                readOnly
                className="sensor-input"
              />
              %
            </div>

            <div className="sensor-row">
              <label>
                <strong>Light:</strong>
              </label>
              <input
                type="number"
                value={latestData.light}
                readOnly
                className="sensor-input"
              />
              lux
            </div>

            <div className="sensor-row">
              <label>
                <strong>Light State:</strong>
              </label>
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

        {/* RIGHT: Last 5 logs */}
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

      {/* NEW SECTION: Upcoming Automations */}
      <div className="dashboard-automations-container">
        <h3>Upcoming Automations</h3>
        {upcomingAutomations.length === 0 ? (
          <p>No upcoming time-based automations.</p>
        ) : (
          <table className="upcoming-automations-table">
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
