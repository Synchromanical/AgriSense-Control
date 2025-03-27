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
  const [upcomingAutomations, setUpcomingAutomations] = useState([]);

  // Subscribe to necessary collections (based on active sensors) and merge
  useEffect(() => {
    // Identify needed collections
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
      const q = query(collection(db, colName), orderBy("timestamp", "asc"));
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

  // Combine the latest doc from each board
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

    // Latest doc for each
    const latestGSMB = gsmDocs.length
      ? gsmDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;
    const latestHPCB = hpcbDocs.length
      ? hpcbDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;
    const latestNSCB = nscbDocs.length
      ? nscbDocs.reduce((a, b) => (new Date(a.timestamp) > new Date(b.timestamp) ? a : b))
      : null;

    // Merge them
    const combinedLatest = {
      temperature: latestGSMB ? formatOneDecimal(latestGSMB.temperature) : "",
      humidity: latestGSMB ? formatOneDecimal(latestGSMB.humidity) : "",
      soilMoisture: latestGSMB ? formatOneDecimal(latestGSMB.soilMoisture) : "",
      light: latestHPCB ? formatOneDecimal(latestHPCB.light) : "",
      lightState: latestHPCB ? latestHPCB.lightState : false,
      fanState: latestHPCB ? latestHPCB.fanState : false,
      waterLevel: latestNSCB ? formatOneDecimal(latestNSCB.waterLevel) : "",
    };

    // Choose a combined timestamp if desired
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

  // Subscribe to automations
  useEffect(() => {
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
    return () => unsub();
  }, []);

  // Filter logs to show only for the sensors user selected
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
            )}

            {sensors.includes("Humidity") && (
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
            )}

            {sensors.includes("Soil Moisture") && (
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
            )}

            {sensors.includes("Water Level") && (
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
            )}

            {sensors.includes("Light") && (
              <>
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
                          readOnly
                        />
                        On
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="lightState"
                          value="false"
                          checked={latestData.lightState === false}
                          readOnly
                        />
                        Off
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Fan State row: displayed below Light State if user has "Fan" */}
            {sensors.includes("Fan") && (
              <div className={styles.sensorRow}>
                <div className={styles.sensorLabel}>
                  <label>
                    <strong>Fan State:</strong>
                  </label>
                </div>
                <div className={styles.sensorInputContainer}>
                  <div className={styles.radioGroup}>
                    <label>
                      <input
                        type="radio"
                        name="fanState"
                        value="true"
                        checked={latestData.fanState === true}
                        readOnly
                      />
                      On
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="fanState"
                        value="false"
                        checked={latestData.fanState === false}
                        readOnly
                      />
                      Off
                    </label>
                  </div>
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
};

export default Dashboard;
