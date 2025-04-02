import React, { useEffect, useState, useContext } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import styles from "../Dashboard.module.css";
import { SensorContext } from "../SensorContext";

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
    light1: "",
    light2: "",
    light3: "",
    light1State: false,
    light2State: false,
    light3State: false,
    fan1State: false,
    fan2State: false,
    fan3State: false,
    // Add new humidifiers:
    humidifier1State: false,
    humidifier2State: false,
    humidifier3State: false,

    waterLevel: "",
    timestamp: null,
  });
  const [rawDashboardLogs, setRawDashboardLogs] = useState([]);
  const [allAutomations, setAllAutomations] = useState([]);

  useEffect(() => {
    const boardsNeeded = new Set();
    if (
      sensors.includes("Temperature") ||
      sensors.includes("Humidity") ||
      sensors.includes("Soil Moisture")
    ) {
      boardsNeeded.add("GSMB");
    }
    if (sensors.some((s) => s.startsWith("Light") || s.startsWith("Fan") || s.startsWith("Humidifier"))) {
      boardsNeeded.add("HPCB");
    }
    if (
      sensors.includes("Water Level") ||
      sensors.includes("Nutrient 1 Level") ||
      sensors.includes("Nutrient 2 Level")
    ) {
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
          boardType: colName,
        }));
        const mergedAll = Object.values(readingsByCollection).flat();
        mergedAll.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setMergedReadings(mergedAll);
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach((u) => u());
  }, [sensors]);

  useEffect(() => {
    if (mergedReadings.length === 0) {
      setLatestData({
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
        timestamp: null,
      });
      setRawDashboardLogs([]);
      return;
    }

    // Separate out the docs from each board
    const gsmDocs = mergedReadings.filter((doc) => doc.boardType === "GSMB");
    const hpcbDocs = mergedReadings.filter((doc) => doc.boardType === "HPCB");
    const nscbDocs = mergedReadings.filter((doc) => doc.boardType === "NSCB");

    const latestGSMB = gsmDocs.length
      ? gsmDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;
    const latestHPCB = hpcbDocs.length
      ? hpcbDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;
    const latestNSCB = nscbDocs.length
      ? nscbDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;

    // Combine the "latest" from each board
    const combinedLatest = {
      temperature: latestGSMB ? formatOneDecimal(latestGSMB.temperature) : "",
      humidity: latestGSMB ? formatOneDecimal(latestGSMB.humidity) : "",
      soilMoisture: latestGSMB ? formatOneDecimal(latestGSMB.soilMoisture) : "",

      light1: latestHPCB && latestHPCB.light1 ? formatOneDecimal(latestHPCB.light1) : "",
      light2: latestHPCB && latestHPCB.light2 ? formatOneDecimal(latestHPCB.light2) : "",
      light3: latestHPCB && latestHPCB.light3 ? formatOneDecimal(latestHPCB.light3) : "",
      light1State: latestHPCB ? !!latestHPCB.light1State : false,
      light2State: latestHPCB ? !!latestHPCB.light2State : false,
      light3State: latestHPCB ? !!latestHPCB.light3State : false,

      fan1State: latestHPCB ? !!latestHPCB.fan1State : false,
      fan2State: latestHPCB ? !!latestHPCB.fan2State : false,
      fan3State: latestHPCB ? !!latestHPCB.fan3State : false,

      // New humidifier states
      humidifier1State: latestHPCB ? !!latestHPCB.humidifier1State : false,
      humidifier2State: latestHPCB ? !!latestHPCB.humidifier2State : false,
      humidifier3State: latestHPCB ? !!latestHPCB.humidifier3State : false,

      waterLevel: latestNSCB ? formatOneDecimal(latestNSCB.waterLevel) : "",
    };

    const timestamps = [];
    if (latestGSMB) timestamps.push(new Date(latestGSMB.timestamp));
    if (latestHPCB) timestamps.push(new Date(latestHPCB.timestamp));
    if (latestNSCB) timestamps.push(new Date(latestNSCB.timestamp));
    const combinedTimestamp = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
    combinedLatest.timestamp = combinedTimestamp;

    setLatestData(combinedLatest);

    // Build raw logs for display
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
        { label: "Light 1", value: docData.light1 },
        { label: "Light 2", value: docData.light2 },
        { label: "Light 3", value: docData.light3 },
        { label: "Light 1 State", value: docData.light1State },
        { label: "Light 2 State", value: docData.light2State },
        { label: "Light 3 State", value: docData.light3State },
        { label: "Fan 1 State", value: docData.fan1State },
        { label: "Fan 2 State", value: docData.fan2State },
        { label: "Fan 3 State", value: docData.fan3State },
        // Add humidifier states to logs
        { label: "Humidifier 1 State", value: docData.humidifier1State },
        { label: "Humidifier 2 State", value: docData.humidifier2State },
        { label: "Humidifier 3 State", value: docData.humidifier3State },

        { label: "Water Level", value: docData.waterLevel },
      ];
      sensorFields.forEach((field) => {
        if (field.value !== undefined && field.value !== null && field.value !== "") {
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "automations"), (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAllAutomations(docs);
    });
    return () => unsub();
  }, []);

  // Filter logs if you only want to display the ones relevant to the active sensors:
  const filteredDashboardLogs = sensors.length
    ? rawDashboardLogs.filter((log) =>
        sensors.some((sensor) =>
          log.action.toLowerCase().includes(sensor.toLowerCase())
        )
      )
    : [];

  const displayedDashboardLogs = filteredDashboardLogs.slice(-5).reverse();

  return (
    <div className={styles.content}>
      <h2>Dashboard</h2>
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
            {/* Fans */}
            {sensors.includes("Fan 1") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Fan 1 State:</strong></label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div>{latestData.fan1State ? "On" : "Off"}</div>
                </div>
              </div>
            )}
            {sensors.includes("Fan 2") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Fan 2 State:</strong></label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div>{latestData.fan2State ? "On" : "Off"}</div>
                </div>
              </div>
            )}
            {sensors.includes("Fan 3") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Fan 3 State:</strong></label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div>{latestData.fan3State ? "On" : "Off"}</div>
                </div>
              </div>
            )}
            {/* Lights */}
            {sensors.includes("Light 1") && (
              <>
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light 1:</strong></label>
                  </div>
                  <div className={styles.sensorInputContainer}>
                    <input
                      type="number"
                      value={latestData.light1}
                      readOnly
                      className={styles.sensorInput}
                    />
                    <span>lux</span>
                  </div>
                </div>
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light 1 State:</strong></label>
                  </div>
                  <div className={styles.sensorInputContainer}>
                    <div>{latestData.light1State ? "On" : "Off"}</div>
                  </div>
                </div>
              </>
            )}
            {sensors.includes("Light 2") && (
              <>
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light 2:</strong></label>
                  </div>
                  <div className={styles.sensorInputContainer}>
                    <input
                      type="number"
                      value={latestData.light2}
                      readOnly
                      className={styles.sensorInput}
                    />
                    <span>lux</span>
                  </div>
                </div>
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light 2 State:</strong></label>
                  </div>
                  <div className={styles.sensorInputContainer}>
                    <div>{latestData.light2State ? "On" : "Off"}</div>
                  </div>
                </div>
              </>
            )}
            {sensors.includes("Light 3") && (
              <>
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light 3:</strong></label>
                  </div>
                  <div className={styles.sensorInputContainer}>
                    <input
                      type="number"
                      value={latestData.light3}
                      readOnly
                      className={styles.sensorInput}
                    />
                    <span>lux</span>
                  </div>
                </div>
                <div className={styles.sensorRow}>
                  <div className={styles.sensorLabel}>
                    <label><strong>Light 3 State:</strong></label>
                  </div>
                  <div className={styles.sensorInputContainer}>
                    <div>{latestData.light3State ? "On" : "Off"}</div>
                  </div>
                </div>
              </>
            )}
            {/* Humidifiers */}
            {sensors.includes("Humidifier 1") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Humidifier 1 State:</strong></label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div>{latestData.humidifier1State ? "On" : "Off"}</div>
                </div>
              </div>
            )}
            {sensors.includes("Humidifier 2") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Humidifier 2 State:</strong></label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div>{latestData.humidifier2State ? "On" : "Off"}</div>
                </div>
              </div>
            )}
            {sensors.includes("Humidifier 3") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label><strong>Humidifier 3 State:</strong></label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div>{latestData.humidifier3State ? "On" : "Off"}</div>
                </div>
              </div>
            )}
            {/* Water Level */}
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
          </div>
        </div>
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
      <div className={styles.dashboardAutomationsContainer}>
        <h3>Automations</h3>
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
              {allAutomations.map((auto) => (
                <tr key={auto.id}>
                  <td>{auto.name}</td>
                  <td>{auto.type}</td>
                  <td>{auto.action}</td>
                  <td>{typeof auto.enabled === "boolean" ? (auto.enabled ? "Yes" : "No") : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
