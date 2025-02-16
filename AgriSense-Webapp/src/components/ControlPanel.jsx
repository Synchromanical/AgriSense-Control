// src/components/ControlPanel.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig";

function formatOneDecimal(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(1);
}

const ControlPanel = () => {
  // -----------------------
  // SENSOR DATA STATES
  // -----------------------
  const [latestData, setLatestData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light: "",
    waterLevel: "",
    lightState: false,
    timestamp: null,
  });
  // For the user to edit
  const [editedData, setEditedData] = useState({
    temperature: "",
    humidity: "",
    soilMoisture: "",
    light: "",
  });

  // -----------------------
  // ALERT STATES
  // -----------------------
  const [alertName, setAlertName] = useState("");  // "Alert Name" input
  const [alertDateTime, setAlertDateTime] = useState(""); // date/time
  const [alerts, setAlerts] = useState([]); // Array of alerts from Firestore
  const [selectedAlertId, setSelectedAlertId] = useState(""); // which alert is selected

  // ----------------------------------------------------------------
  // 1) REAL-TIME LISTENER FOR LATEST SENSOR DATA (limit 1, desc)
  // ----------------------------------------------------------------
  useEffect(() => {
    const sensorCollection = collection(db, "sensorData");
    const q = query(sensorCollection, orderBy("timestamp", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        setLatestData({
          temperature: formatOneDecimal(data.temperature),
          humidity: formatOneDecimal(data.humidity),
          soilMoisture: formatOneDecimal(data.soilMoisture),
          light: formatOneDecimal(data.light),
          waterLevel: data.waterLevel ?? "",
          lightState: data.lightState ?? false,
          timestamp: data.timestamp
        });

        // Initialize the "Set To" inputs with the same values
        setEditedData({
          temperature: formatOneDecimal(data.temperature),
          humidity: formatOneDecimal(data.humidity),
          soilMoisture: formatOneDecimal(data.soilMoisture),
          light: formatOneDecimal(data.light),
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // ----------------------------------------------------------------
  // 2) REAL-TIME LISTENER FOR ALERTS ( alerts collection )
  // ----------------------------------------------------------------
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "alerts"), (snapshot) => {
      const fetched = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      setAlerts(fetched);
    });
    return () => unsub();
  }, []);

  // ----------------------------------------------------------------
  // 3) CREATE A NEW READING DOC FOR ANY UPDATE
  // ----------------------------------------------------------------
  async function createNewReading(updatedFields) {
    const mergedData = {
      // parse floats
      temperature:
        parseFloat(updatedFields.temperature ?? latestData.temperature) || 0,
      humidity:
        parseFloat(updatedFields.humidity ?? latestData.humidity) || 0,
      soilMoisture:
        parseFloat(updatedFields.soilMoisture ?? latestData.soilMoisture) || 0,
      light: parseFloat(updatedFields.light ?? latestData.light) || 0,
      // keep these from the latest doc
      waterLevel: latestData.waterLevel ?? 0,
      lightState: latestData.lightState,
      // new timestamp
      timestamp: new Date(),
    };

    try {
      await addDoc(collection(db, "sensorData"), mergedData);
    } catch (error) {
      console.error("Error creating new reading doc:", error);
    }
  }

  // ----------------------------------------------------------------
  // 4) HANDLERS FOR “SET” AND “SET ALL”
  // ----------------------------------------------------------------
  // Only allow numeric keys (besides arrow, backspace, etc.)
  const handleKeyDown = (e) => {
    const allowedKeys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Backspace",
      "Tab",
      "Delete",
      "Enter",
      ".",
    ];
    const isNumberKey =
      (e.key >= "0" && e.key <= "9") || (e.keyCode >= 96 && e.keyCode <= 105);

    if (!allowedKeys.includes(e.key) && !isNumberKey) {
      e.preventDefault();
    }
  };

  const handleSetSensor = async (field) => {
    const newValue = editedData[field];
    await createNewReading({ [field]: newValue });
  };

  const handleSetAllSensors = async () => {
    await createNewReading({
      temperature: editedData.temperature,
      humidity: editedData.humidity,
      soilMoisture: editedData.soilMoisture,
      light: editedData.light,
    });
  };

  // ----------------------------------------------------------------
  // 5) ALERTS CRUD
  // ----------------------------------------------------------------
  const handleSetAlert = async () => {
    if (!alertName.trim() || !alertDateTime) {
      // do nothing if missing
      return;
    }
    const newAlert = { name: alertName.trim(), dateTime: alertDateTime };
    try {
      await addDoc(collection(db, "alerts"), newAlert);
      // Clear fields
      setAlertName("");
      setAlertDateTime("");
      setSelectedAlertId("");
    } catch (error) {
      console.error("Error adding alert:", error);
    }
  };

  const handleSelectAlert = (e) => {
    const id = e.target.value;
    setSelectedAlertId(id);

    if (!id) {
      // user selected “-- No alert selected --”
      setAlertName("");
      setAlertDateTime("");
      return;
    }
    const found = alerts.find((a) => a.id === id);
    if (found) {
      setAlertName(found.name);
      setAlertDateTime(found.dateTime);
    }
  };

  const handleUpdateAlert = async () => {
    if (!selectedAlertId) return;
    try {
      const docRef = doc(db, "alerts", selectedAlertId);
      await updateDoc(docRef, {
        name: alertName.trim(),
        dateTime: alertDateTime,
      });
    } catch (error) {
      console.error("Error updating alert:", error);
    }
  };

  const handleClearAlerts = async () => {
    // Danger: This will delete ALL docs in “alerts”
    try {
      // We dynamically import getDocs to avoid naming collisions
      const snap = await import("firebase/firestore").then(({ getDocs }) =>
        getDocs(collection(db, "alerts"))
      );
      for (const alertDoc of snap.docs) {
        await deleteDoc(doc(db, "alerts", alertDoc.id));
      }
      setSelectedAlertId("");
      setAlertName("");
      setAlertDateTime("");
    } catch (error) {
      console.error("Error clearing alerts:", error);
    }
  };

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------
  return (
    <div className="content">
      <h2>Control Panel</h2>

      {/* SENSOR CONTROL SECTION */}
      <div className="control-panel-container">
        <div className="control-panel-grid">
          {/* Table header row */}
          <div></div>
          <div className="heading-col">Current</div>
          <div className="heading-col">Set To</div>
          <div></div>

          {/* Temperature row */}
          <div className="row-label">
            <strong>Temperature:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.temperature}
              readOnly
              className="sensor-input"
            />
            <span className="unit">°C</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.temperature}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, temperature: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">°C</span>
          </div>
          <div className="row-set">
            <button
              onClick={() => handleSetSensor("temperature")}
              className="set-button"
            >
              Set
            </button>
          </div>

          {/* Humidity row */}
          <div className="row-label">
            <strong>Humidity:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.humidity}
              readOnly
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.humidity}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, humidity: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-set">
            <button
              onClick={() => handleSetSensor("humidity")}
              className="set-button"
            >
              Set
            </button>
          </div>

          {/* Soil Moisture row */}
          <div className="row-label">
            <strong>Soil Moisture:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.soilMoisture}
              readOnly
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.soilMoisture}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, soilMoisture: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">%</span>
          </div>
          <div className="row-set">
            <button
              onClick={() => handleSetSensor("soilMoisture")}
              className="set-button"
            >
              Set
            </button>
          </div>

          {/* Light row */}
          <div className="row-label">
            <strong>Light:</strong>
          </div>
          <div className="row-latest">
            <input
              type="number"
              value={latestData.light}
              readOnly
              className="sensor-input"
            />
            <span className="unit">lux</span>
          </div>
          <div className="row-edited">
            <input
              type="number"
              value={editedData.light}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, light: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="sensor-input"
            />
            <span className="unit">lux</span>
          </div>
          <div className="row-set">
            <button
              onClick={() => handleSetSensor("light")}
              className="set-button"
            >
              Set
            </button>
          </div>

          {/* "Set All" button */}
          <div></div>
          <div></div>
          <div></div>
          <div className="row-set">
            <button onClick={handleSetAllSensors} className="set-button">
              Set All
            </button>
          </div>
        </div>
      </div>

      {/* ALERTS SECTION */}
      <div className="alert-container">
        <div className="alert-grid-4col">
          {/* Column 1: Alert name */}
          <div className="alert-left">
            <label className="alert-step">1. Create/Update Alert Name</label>
            <div className="alert-name-row">
              <input
                type="text"
                id="alertName"
                className="alert-name-input"
                value={alertName}
                onChange={(e) => setAlertName(e.target.value)}
              />
            </div>
          </div>

          {/* Column 2: date/time */}
          <div className="alert-middle">
            <label className="alert-step">2. Save/Update Time</label>
            <input
              type="datetime-local"
              className="alert-datetime-input"
              value={alertDateTime}
              onChange={(e) => setAlertDateTime(e.target.value)}
            />
          </div>

          {/* Column 3: set/update buttons */}
          <div className="alert-right">
            <label className="alert-right-label">3. Set/Update Alert</label>
            <div className="alert-buttons">
              <button onClick={handleSetAlert}>Set Alert</button>
              <button
                onClick={handleUpdateAlert}
                disabled={!selectedAlertId}
              >
                Update Alert
              </button>
            </div>
          </div>

          {/* Column 4: saved alerts dropdown + Clear */}
          <div className="alert-saved">
            <label className="alert-last-label">Saved Alert(s)</label>
            <select
              value={selectedAlertId}
              onChange={handleSelectAlert}
              className="alert-dropdown"
            >
              <option value="">-- No alert selected --</option>
              {alerts.map((alert) => {
                const display = `${alert.name} (${alert.dateTime})`;
                return (
                  <option key={alert.id} value={alert.id}>
                    {display}
                  </option>
                );
              })}
            </select>
            <button onClick={handleClearAlerts} className="alert-clear-button">
              Clear Alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
