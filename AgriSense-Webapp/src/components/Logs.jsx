import React, { useEffect, useState, useRef, useContext } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import styles from "../Logs.module.css";
import { SensorContext } from "../SensorContext";

function getTimestampString(date = new Date()) {
  const iso = date.toISOString();
  const [withoutMillis] = iso.split(".");
  return withoutMillis + "Z";
}

const Logs = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const fileInputRef = useRef(null);
  const logsPerPage = 25;

  // Only subscribe to sensorData for the selected node (using nodeNumber as a number)
  useEffect(() => {
    const q = query(
      collection(db, "sensorData"),
      where("nodeNumber", "==", Number(selectedInstance)),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const newLogs = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let timeObj;
        if (data.timestamp && typeof data.timestamp === "string") {
          timeObj = new Date(data.timestamp);
        } else {
          timeObj = new Date(0);
        }
        const timeDisplay = timeObj.toLocaleString();
        const sensorFields = [
          { label: "Temperature", value: data.temperature },
          { label: "Humidity", value: data.humidity },
          { label: "Soil Moisture", value: data.soilMoisture },
          { label: "Light", value: data.light },
          { label: "Water Level", value: data.waterLevel },
          { label: "Light State", value: data.lightState },
          { label: "Fan State", value: data.fanState },
        ];
        sensorFields.forEach((field) => {
          if (field.value !== undefined && field.value !== null) {
            newLogs.push({
              time: timeObj,
              timeDisplay,
              action: `Reading of ${field.label}: ${field.value}`,
            });
          }
        });
      });
      newLogs.forEach((log, idx) => {
        log.id = idx + 1;
      });
      setLogs(newLogs);
    });
    return () => unsub();
  }, [selectedInstance]);

  const filteredLogs = logs.filter((log) => {
    const textMatch =
      searchTerm === "" ||
      log.id.toString().includes(searchTerm) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    let timeMatch = true;
    if (startTime) {
      const startDate = new Date(startTime);
      timeMatch = timeMatch && log.time >= startDate;
    }
    if (endTime) {
      const endDate = new Date(endTime);
      timeMatch = timeMatch && log.time <= endDate;
    }
    const sensorMatch =
      sensors.length > 0 &&
      sensors.some((sensor) =>
        log.action.toLowerCase().includes(sensor.toLowerCase())
      );
    return textMatch && timeMatch && sensorMatch;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startTime, endTime, sensors]);

  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const renderPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`${styles.paginationButton} ${currentPage === i ? styles.active : ""}`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  const handleExportLogs = () => {
    const exportData = logs.map((log) => ({
      id: log.id,
      time: log.time?.toISOString() || null,
      action: log.action,
    }));
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "logs.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportLogs = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        for (const item of imported) {
          const stringTime = item.time ? item.time : getTimestampString();
          await addDoc(collection(db, "sensorData"), {
            temperature: 0,
            humidity: 0,
            soilMoisture: 0,
            light: 0,
            waterLevel: 0,
            lightState: false,
            fanState: false,
            timestamp: stringTime,
            nodeNumber: Number(selectedInstance), // Write nodeNumber as a number
          });
        }
      } catch (error) {
        console.error("Error parsing imported file", error);
      }
    };
    reader.readAsText(file);
  };

  const handleClearLogs = async () => {
    try {
      const snap = await import("firebase/firestore").then(({ getDocs }) =>
        getDocs(collection(db, "sensorData"))
      );
      for (const logDoc of snap.docs) {
        await deleteDoc(doc(db, "sensorData", logDoc.id));
      }
    } catch (error) {
      console.error("Error clearing logs:", error);
    }
  };

  return (
    <div className={styles.content}>
      <h2>All Logs</h2>
      {sensors.length === 0 ? (
        <p>Please select a sensor in the Sensor tab to view logs.</p>
      ) : (
        <>
          <div className={styles.logsContainer}>
            <div className={styles.logsFilters}>
              <div className={styles.logsTimeSearch}>
                <div className={styles.logsTimeTitle}>Search Between</div>
                <div className={styles.logsTimeInputs}>
                  <div className={styles.logsTimeGroup}>
                    <label htmlFor="startTime" className={styles.logsTimeLabel}>
                      Start
                    </label>
                    <input
                      type="datetime-local"
                      id="startTime"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={styles.logsTimeInput}
                    />
                  </div>
                  <div className={styles.logsTimeGroup}>
                    <label htmlFor="endTime" className={styles.logsTimeLabel}>
                      End
                    </label>
                    <input
                      type="datetime-local"
                      id="endTime"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={styles.logsTimeInput}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.logsTextSearch}>
                <label htmlFor="logsSearch" className={styles.logsSearchLabel}>
                  Search
                </label>
                <input
                  type="text"
                  id="logsSearch"
                  placeholder="Search by ID or Action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.logsSearch}
                />
              </div>
            </div>
            <table className={styles.logsTable}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentLogs.length > 0 ? (
                  currentLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{log.timeDisplay}</td>
                      <td>{log.action}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">No logs available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.logsActionButtons}>
            <div className={styles.logsButtons}>
              <button onClick={handleExportLogs} className={styles.logsButton}>
                Export Logs
              </button>
              <button onClick={() => fileInputRef.current.click()} className={styles.logsButton}>
                Import Logs
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleImportLogs}
                accept=".json"
              />
            </div>
            <div>
              <button onClick={handleClearLogs} className={styles.clearLogsButton}>
                Clear Logs
              </button>
            </div>
          </div>
          {filteredLogs.length > logsPerPage && (
            <div className={styles.paginationContainer}>
              <button onClick={handlePrevPage} disabled={currentPage === 1} className={styles.paginationButton}>
                Previous
              </button>
              {renderPageNumbers()}
              <button onClick={handleNextPage} disabled={currentPage === totalPages} className={styles.paginationButton}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Logs;
