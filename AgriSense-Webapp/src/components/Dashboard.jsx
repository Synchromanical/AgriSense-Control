import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  arrayUnion
} from "firebase/firestore";
import debounce from "lodash/debounce";
import { db } from "../firebaseConfig";

// Utility to format numeric values to 1 decimal place
function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

function Dashboard() {
  // State for sensor values including lightState
  const [latestData, setLatestData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light: "",
    waterLevel: "",
    lightState: false,
  });

  // State for storing the document ID of the latest sensor data document
  const [latestDocId, setLatestDocId] = useState(null);

  // State for the dashboard logs (latest 5 logs)
  const [dashboardLogs, setDashboardLogs] = useState([]);

  // -------------------------------
  // 1) FETCH LATEST SENSOR DATA
  // -------------------------------
  useEffect(() => {
    const fetchLatestSensorData = async () => {
      try {
        const sensorCollection = collection(db, "sensorData");
        const q = query(sensorCollection, orderBy("timestamp", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((docSnapshot) => {
          setLatestDocId(docSnapshot.id);
          const data = docSnapshot.data();
          setLatestData({
            temperature: data.temperature
              ? formatOneDecimal(data.temperature[data.temperature.length - 1])
              : "",
            humidity: data.humidity
              ? formatOneDecimal(data.humidity[data.humidity.length - 1])
              : "",
            soilMoisture: data.soilMoisture
              ? formatOneDecimal(data.soilMoisture[data.soilMoisture.length - 1])
              : "",
            light: data.light ? formatOneDecimal(data.light[data.light.length - 1]) : "",
            waterLevel: data.waterLevel !== undefined ? data.waterLevel : "",
            lightState: data.lightState !== undefined ? data.lightState : false,
          });
        });
      } catch (error) {
        console.error("Error fetching sensor data:", error);
      }
    };

    fetchLatestSensorData();
  }, []);

  // -------------------------------
  // 2) FETCH LATEST 5 LOGS
  // -------------------------------
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const sensorCollection = collection(db, "sensorData");
        const querySnapshot = await getDocs(sensorCollection);
        const logsData = [];

        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const timestampArray = data.timestamp; // Shared timestamp array

          // Helper to create log entries from each sensor's array
          const addLogEntry = (sensorType, values) => {
            if (Array.isArray(values) && Array.isArray(timestampArray)) {
              values.forEach((value, index) => {
                if (timestampArray[index]) {
                  logsData.push({
                    time: new Date(timestampArray[index]),
                    action: `Collected data of ${sensorType}: ${value}`,
                  });
                }
              });
            }
          };

          addLogEntry("Temperature", data.temperature);
          addLogEntry("Humidity", data.humidity);
          addLogEntry("Soil Moisture", data.soilMoisture);
          addLogEntry("Light", data.light);
        });

        // Sort logs in descending order (latest first)
        logsData.sort((a, b) => b.time - a.time);

        // Keep only the latest 5 logs
        const latestFive = logsData.slice(0, 5).map((log, index) => ({
          id: index + 1, // local index
          time: log.time.toLocaleString(),
          action: log.action,
        }));

        setDashboardLogs(latestFive);
      } catch (error) {
        console.error("Error fetching dashboard logs:", error);
      }
    };

    fetchLogs();
  }, []);

  // -------------------------------
  // HANDLERS & HELPERS
  // -------------------------------

  // Local state updates for sensor inputs
  const handleChange = (e, key) => {
    setLatestData((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));
  };

  // Prevent direct typing into numeric fields (except arrow keys, Tab, Enter)
  const handleKeyDown = (e) => {
    const allowedKeys = ["ArrowUp", "ArrowDown", "Tab", "Enter"];
    if (!allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  /**
   * updateSensorInFirebase: Appends a new float value to the specified array field
   * and also appends a new timestamp to `timestamp`.
   * This is done for temperature, humidity, soilMoisture, and light changes.
   */
  const updateSensorInFirebase = async (field, stringValue) => {
    if (!latestDocId) return;
    try {
      const docRef = doc(db, "sensorData", latestDocId);
      const floatVal = parseFloat(stringValue) || 0;

      // Create a new timestamp as an ISO string
      const now = new Date().toISOString();

      await updateDoc(docRef, {
        [field]: arrayUnion(floatVal),
        timestamp: arrayUnion(now),
      });

      // Update local state to show 1 decimal place
      setLatestData((prev) => ({
        ...prev,
        [field]: floatVal.toFixed(1),
      }));
    } catch (error) {
      console.error(`Error updating ${field} in Firebase:`, error);
    }
  };

  // Debounced version for the Light slider
  const debouncedUpdateSensor = useCallback(
    debounce((field, stringValue) => {
      if (!latestDocId) return;
      const docRef = doc(db, "sensorData", latestDocId);
      const floatVal = parseFloat(stringValue) || 0;
      const now = new Date().toISOString();

      updateDoc(docRef, {
        [field]: arrayUnion(floatVal),
        timestamp: arrayUnion(now),
      })
        .then(() => {
          // Update local state to show 1 decimal place for the slider value
          setLatestData((prev) => ({
            ...prev,
            [field]: floatVal.toFixed(1),
          }));
        })
        .catch((error) => {
          console.error(`Error updating ${field} (debounced) in Firebase:`, error);
        });
    }, 500),
    [latestDocId]
  );

  // Fill water with a direct update (no timestamp needed)
  const fillWater = async () => {
    if (!latestDocId) return;
    try {
      const docRef = doc(db, "sensorData", latestDocId);
      await updateDoc(docRef, { waterLevel: 100 });
      setLatestData((prevData) => ({ ...prevData, waterLevel: 100 }));
    } catch (error) {
      console.error("Error updating water level in Firebase:", error);
    }
  };

  // Update lightState as a boolean (no timestamp needed)
  const updateLightStateInFirebase = async (value) => {
    if (!latestDocId) return;
    try {
      const docRef = doc(db, "sensorData", latestDocId);
      await updateDoc(docRef, { lightState: value });
    } catch (error) {
      console.error("Error updating light state in Firebase:", error);
    }
  };

  // Handler for the light state radio buttons
  const handleLightStateChange = (e) => {
    const value = e.target.value === "true";
    setLatestData((prevData) => ({ ...prevData, lightState: value }));
    updateLightStateInFirebase(value);
  };

  // -------------------------------
  // RENDER
  // -------------------------------
  return (
    <div className="content">
      <h2>Dashboard</h2>
      <div className="dashboard-container">
        {/* Left side: sensor data */}
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
                onChange={(e) => handleChange(e, "temperature")}
                onBlur={() => updateSensorInFirebase("temperature", latestData.temperature)}
                onKeyDown={handleKeyDown}
                className="sensor-input"
              />{" "}
              °C
            </div>
            <div className="sensor-row">
              <label>
                <strong>Humidity:</strong>
              </label>
              <input
                type="number"
                value={latestData.humidity}
                onChange={(e) => handleChange(e, "humidity")}
                onBlur={() => updateSensorInFirebase("humidity", latestData.humidity)}
                onKeyDown={handleKeyDown}
                className="sensor-input"
              />{" "}
              %
            </div>
            <div className="sensor-row">
              <label>
                <strong>Soil Moisture:</strong>
              </label>
              <input
                type="number"
                value={latestData.soilMoisture}
                onChange={(e) => handleChange(e, "soilMoisture")}
                onBlur={() => updateSensorInFirebase("soilMoisture", latestData.soilMoisture)}
                onKeyDown={handleKeyDown}
                className="sensor-input"
              />{" "}
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
              />{" "}
              %
              <button onClick={fillWater} className="fill-water-button">
                Fill Water
              </button>
            </div>
            <div className="sensor-row">
              <label>
                <strong>Light:</strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={latestData.light}
                onChange={(e) => {
                  handleChange(e, "light");
                  debouncedUpdateSensor("light", latestData.light);
                }}
                className="sensor-slider"
              />
              <span>{formatOneDecimal(latestData.light)} lux</span>
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

        {/* Right side: logs table */}
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
                    <td className="logs-td">{log.time}</td>
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
