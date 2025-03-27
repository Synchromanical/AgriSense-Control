import React, { useEffect, useState, useContext } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import styles from "../Dashboard.module.css";
import { SensorContext } from "../SensorContext";

// Utility to format certain numeric fields to one decimal if needed
function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

const Dashboard = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];

  const [mergedReadings, setMergedReadings] = useState([]);
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
  const [rawDashboardLogs, setRawDashboardLogs] = useState([]);

  // In the old version, you might have had "upcomingAutomations."
  // We rename it to a simpler "allAutomations" to store *all* documents from "automations".
  const [allAutomations, setAllAutomations] = useState([]);

  // 1. Subscribe to sensor collections based on user’s active sensors
  useEffect(() => {
    const boardsNeeded = new Set();
    if (sensors.includes("Temperature") || sensors.includes("Humidity") || sensors.includes("Soil Moisture")) {
      boardsNeeded.add("GSMB");
    }
    if (sensors.includes("Light") || sensors.includes("Fan")) {
      boardsNeeded.add("HPCB");
    }
    if (sensors.includes("Water Level")) {
      boardsNeeded.add("NSCB");
    }

    const unsubscribes = [];
    const readingsByCollection = {};

    boardsNeeded.forEach((colName) => {
      readingsByCollection[colName] = [];
      const colRef = collection(db, colName);
      const q = query(colRef, orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        readingsByCollection[colName] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          boardType: colName, // tag the doc with its collection name
        }));
        const mergedAll = Object.values(readingsByCollection).flat();
        mergedAll.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setMergedReadings(mergedAll);
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach((u) => u());
  }, [sensors]);

  // 2. Combine the latest doc from each board into `latestData`
  //    and build logs from mergedReadings.
  useEffect(() => {
    if (mergedReadings.length === 0) {
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
      setRawDashboardLogs([]);
      return;
    }

    // Filter by board
    const gsmDocs = mergedReadings.filter((doc) => doc.boardType === "GSMB");
    const hpcbDocs = mergedReadings.filter((doc) => doc.boardType === "HPCB");
    const nscbDocs = mergedReadings.filter((doc) => doc.boardType === "NSCB");

    // Latest doc from each board
    const latestGSMB = gsmDocs.length
      ? gsmDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;
    const latestHPCB = hpcbDocs.length
      ? hpcbDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;
    const latestNSCB = nscbDocs.length
      ? nscbDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;

    // Merge them into a single object
    const combinedLatest = {
      temperature: latestGSMB ? formatOneDecimal(latestGSMB.temperature) : "",
      humidity: latestGSMB ? formatOneDecimal(latestGSMB.humidity) : "",
      soilMoisture: latestGSMB ? formatOneDecimal(latestGSMB.soilMoisture) : "",
      light: latestHPCB ? formatOneDecimal(latestHPCB.light) : "",
      lightState: latestHPCB ? latestHPCB.lightState : false,
      fanState: latestHPCB ? latestHPCB.fanState : false,
      waterLevel: latestNSCB ? formatOneDecimal(latestNSCB.waterLevel) : "",
    };

    // Choose a combined timestamp if you like
    const timestamps = [];
    if (latestGSMB) timestamps.push(new Date(latestGSMB.timestamp));
    if (latestHPCB) timestamps.push(new Date(latestHPCB.timestamp));
    if (latestNSCB) timestamps.push(new Date(latestNSCB.timestamp));
    const combinedTimestamp =
      timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
    combinedLatest.timestamp = combinedTimestamp;

    setLatestData(combinedLatest);

    // Build logs from mergedReadings
    const lines = [];
    mergedReadings.forEach((docData) => {
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
    lines.forEach((line, idx) => {
      line.id = idx + 1;
    });
    setRawDashboardLogs(lines);
  }, [mergedReadings]);

  // 3. Subscribe to *all* automations from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "automations"), (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      // This array now includes *all* automations, regardless of type.
      setAllAutomations(docs);
    });
    return () => unsub();
  }, []);

  // 4. Optionally filter logs so only sensors the user selected are shown
  const filteredDashboardLogs = sensors.length
    ? rawDashboardLogs.filter((log) =>
        sensors.some((sensor) => log.action.toLowerCase().includes(sensor.toLowerCase()))
      )
    : [];

  // For display, we show the last 5 logs in reverse order
  const displayedDashboardLogs = filteredDashboardLogs.slice(-5).reverse();

  return (
    <div className={styles.content}>
      <h2>Dashboard</h2>

      {/* Sensor Data Display */}
      <div className={styles.dashboardContainer}>
        <div className={styles.sensorDataContainer}>
          <div className={styles.sensorData}>
            <h3>Latest Sensor Data</h3>

            {sensors.includes("Temperature") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Temperature:</strong></label>
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
            )}

            {sensors.includes("Humidity") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Humidity:</strong></label>
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
            )}

            {sensors.includes("Soil Moisture") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Soil Moisture:</strong></label>
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
            )}

            {sensors.includes("Water Level") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Water Level:</strong></label>
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
            )}

            {sensors.includes("Light") && (
              <>
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light:</strong></label>
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
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light State:</strong></label>
                  </div>
                  <div className={styles.sensorInputContainer}>
                    <div>
                      {latestData.lightState ? "On" : "Off"}
                    </div>
                  </div>
                </div>
              </>
            )}

            {sensors.includes("Fan") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Fan State:</strong></label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div>
                    {latestData.fanState ? "On" : "Off"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Logs on the right side */}
        <div className={styles.dashboardLogsContainer}>
          <h3>Latest Logs</h3>
          {displayedDashboardLogs.length > 0 ? (
            <table className={styles.logsTable}>
              <thead>
                <tr>
                  <th className={styles.logsTh}>ID</th>
                  <th className={styles.logsTh}>Time</th>
                  <th className={styles.logsTh}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedDashboardLogs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.logsTd}>{log.id}</td>
                    <td className={styles.logsTd}>{log.timeDisplay}</td>
                    <td className={styles.logsTd}>{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No logs available</p>
          )}
        </div>
      </div>

      {/* Instead of "Upcoming Automations," we now show *all* automations. */}
      <div className={styles.dashboardAutomationsContainer}>
        <h3>All Automations</h3>
        {allAutomations.length === 0 ? (
          <p>No automations found.</p>
        ) : (
          <table className={styles.upcomingAutomationsTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Action</th>
                <th>Enabled?</th>
              </tr>
            </thead>
            <tbody>
              {allAutomations.map((auto) => {
                return (
                  <tr key={auto.id}>
                    <td>{auto.name}</td>
                    <td>{auto.type}</td>
                    <td>{auto.action}</td>
                    {/* If "enabled" is stored as a boolean: */}
                    <td>{typeof auto.enabled === "boolean" ? (auto.enabled ? "Yes" : "No") : "N/A"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
