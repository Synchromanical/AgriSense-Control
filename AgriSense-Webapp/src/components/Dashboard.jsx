import React, { useContext } from "react";
import styles from "../Dashboard.module.css";
import { SensorContext } from "../SensorContext";
import { useDataContext } from "../DataContext";

const Dashboard = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const { dataState } = useDataContext();

  const sensors = activeSensors[selectedInstance] || [];
  const latestData = dataState.latest;
  const allLogs = dataState.mergedLogs;

  // Maps the user-facing sensor name to the relevant fields in Firestore
  const sensorMapping = {
    "Temperature": [
      { label: "Temperature", field: "temperature", unit: "°C" },
    ],
    "Humidity": [
      { label: "Humidity", field: "humidity", unit: "%" },
    ],
    "Soil Moisture": [
      { label: "Soil Moisture", field: "soilMoisture", unit: "%" },
    ],
    "Fan 1": [{ label: "Fan 1 State", field: "fan1State", isBoolean: true }],
    "Fan 2": [{ label: "Fan 2 State", field: "fan2State", isBoolean: true }],
    "Fan 3": [{ label: "Fan 3 State", field: "fan3State", isBoolean: true }],

    "Light 1": [
      { label: "Light 1", field: "light1", unit: "lux" },
      { label: "Light 1 State", field: "light1State", isBoolean: true },
    ],
    "Light 2": [
      { label: "Light 2", field: "light2", unit: "lux" },
      { label: "Light 2 State", field: "light2State", isBoolean: true },
    ],
    "Light 3": [
      { label: "Light 3", field: "light3", unit: "lux" },
      { label: "Light 3 State", field: "light3State", isBoolean: true },
    ],

    "Humidifier 1": [
      { label: "Humidifier 1 State", field: "humidifier1State", isBoolean: true },
    ],
    "Humidifier 2": [
      { label: "Humidifier 2 State", field: "humidifier2State", isBoolean: true },
    ],
    "Humidifier 3": [
      { label: "Humidifier 3 State", field: "humidifier3State", isBoolean: true },
    ],

    "Water Level": [
      { label: "Water Level", field: "waterLevel", unit: "%" },
    ],
    "Nutrient 1 Level": [
      { label: "Nutrient 1 Level", field: "nutrient1", unit: "%" },
    ],
    "Nutrient 2 Level": [
      { label: "Nutrient 2 Level", field: "nutrient2", unit: "%" },
    ],
  };

  // Filter logs to show only those matching the current instance’s sensors
  const filteredLogs = sensors.length
    ? allLogs.filter((log) =>
        sensors.some((s) => log.action.toLowerCase().includes(s.toLowerCase()))
      )
    : [];

  // Show last 5 logs in descending order
  const displayedDashboardLogs = filteredLogs.slice(-5).reverse();

  // All automations
  const allAutomations = dataState.automations;

  return (
    <div className={styles.content}>
      <h2>Dashboard</h2>

      <div className={styles.dashboardContainer}>
        {/* LEFT: LATEST SENSOR DATA */}
        <div className={styles.sensorDataContainer}>
          <div className={styles.sensorData}>
            <h3>Latest Sensor Data</h3>

            {/* NEW: Two-column grid for the sensor labels/values */}
            <div className={styles.latestSensorGrid}>
              {sensors.map((sensorName) => {
                const fieldDefs = sensorMapping[sensorName];
                if (!fieldDefs) return null;

                return fieldDefs.map((def) => {
                  const rawValue = latestData[def.field];

                  return (
                    <React.Fragment key={`${sensorName}-${def.field}`}>
                      {/* First column: Label */}
                      <div className={styles.latestLabel}>
                        <strong>{def.label}:</strong>
                      </div>

                      {/* Second column: Value */}
                      <div className={styles.latestValue}>
                        {/* Boolean => show On/Off text; numeric => show number */}
                        {def.isBoolean ? (
                          <input
                            type="text"
                            readOnly
                            value={rawValue ? "On" : "Off"}
                            className={styles.sensorInput}
                          />
                        ) : (
                          <>
                            <input
                              type="number"
                              readOnly
                              value={rawValue ?? ""}
                              className={styles.sensorInput}
                            />
                            {def.unit && (
                              <span className={styles.unit}>{def.unit}</span>
                            )}
                          </>
                        )}
                      </div>
                    </React.Fragment>
                  );
                });
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: LATEST LOGS */}
        <div className={styles.dashboardLogsContainer}>
          <h3>Latest Logs</h3>
          {displayedDashboardLogs.length > 0 ? (
            <table className={styles.logsTable}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Time</th>
                  <th>Action</th>
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

      {/* AUTOMATIONS TABLE */}
      <div className={styles.dashboardAutomationsContainer}>
        <h3>Automations</h3>
        {!allAutomations.length ? (
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
                  <td>{auto.enabled ? "Yes" : "No"}</td>
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
