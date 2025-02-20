// src/components/Logs.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  addDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// Helper to produce a string timestamp
function getTimestampString(date = new Date()) {
  const iso = date.toISOString();
  const [withoutMillis] = iso.split(".");
  return withoutMillis + "Z";
}

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const fileInputRef = useRef(null);

  const logsPerPage = 25;

  // ----------------------------------------------------------------
  // 1) REAL-TIME LISTENER: sensorData, ORDER ASC
  // ----------------------------------------------------------------
  useEffect(() => {
    const q = query(collection(db, "sensorData"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const newLogs = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        // Convert string timestamp to JS Date
        let timeObj;
        if (data.timestamp && typeof data.timestamp === "string") {
          timeObj = new Date(data.timestamp);
        } else {
          timeObj = new Date(0);
        }

        const timeDisplay = timeObj.toLocaleString();

        // Add new "Fan State" etc. to the sensor fields
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

      // lines are ascending
      newLogs.forEach((log, idx) => {
        log.id = idx + 1;
      });

      setLogs(newLogs);
    });

    return () => unsub();
  }, []);

  // ----------------------------------------------------------------
  // 2) FILTERING: time range & text search
  // ----------------------------------------------------------------
  const filteredLogs = logs.filter((log) => {
    // Text filter
    const textMatch =
      searchTerm === "" ||
      log.id.toString().includes(searchTerm) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());

    // Time filter
    let timeMatch = true;
    if (startTime) {
      const startDate = new Date(startTime);
      timeMatch = timeMatch && log.time >= startDate;
    }
    if (endTime) {
      const endDate = new Date(endTime);
      timeMatch = timeMatch && log.time <= endDate;
    }

    return textMatch && timeMatch;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startTime, endTime]);

  // ----------------------------------------------------------------
  // 3) PAGINATION
  // ----------------------------------------------------------------
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
          className={`pagination-button ${currentPage === i ? "active" : ""}`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  // ----------------------------------------------------------------
  // 4) IMPORT / EXPORT / CLEAR
  // ----------------------------------------------------------------
  // Export logs as JSON
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

  // Import logs from JSON
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
          });
        }
      } catch (error) {
        console.error("Error parsing imported file", error);
      }
    };
    reader.readAsText(file);
  };

  // Clear logs from Firestore
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

  // ----------------------------------------------------------------
  // 5) RENDER
  // ----------------------------------------------------------------
  return (
    <div className="content">
      <h2>All Logs</h2>
      <div className="logs-container">
        {/* Filters */}
        <div className="logs-filters">
          {/* Time range */}
          <div className="logs-time-search">
            <div className="logs-time-title">Search Between</div>
            <div className="logs-time-inputs">
              <div className="logs-time-group">
                <label htmlFor="startTime" className="logs-time-label">
                  Start
                </label>
                <input
                  type="datetime-local"
                  id="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="logs-time-input"
                />
              </div>
              <div className="logs-time-group">
                <label htmlFor="endTime" className="logs-time-label">
                  End
                </label>
                <input
                  type="datetime-local"
                  id="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="logs-time-input"
                />
              </div>
            </div>
          </div>

          {/* Search text */}
          <div className="logs-text-search">
            <label htmlFor="logsSearch" className="logs-search-label">
              Search
            </label>
            <input
              type="text"
              id="logsSearch"
              placeholder="Search by ID or Action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="logs-search"
            />
          </div>
        </div>

        {/* Table */}
        <table className="logs-table">
          <thead>
            <tr>
              <th className="logs-th">ID</th>
              <th className="logs-th">Time</th>
              <th className="logs-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentLogs.length > 0 ? (
              currentLogs.map((log) => (
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

      {/* Import/Export/Clear */}
      <div className="logs-action-buttons">
        <div className="logs-buttons">
          <button onClick={handleExportLogs} className="logs-button">
            Export Logs
          </button>
          <button
            onClick={() => fileInputRef.current.click()}
            className="logs-button"
          >
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
        <div className="clear-logs-container">
          <button onClick={handleClearLogs} className="clear-logs-button">
            Clear Logs
          </button>
        </div>
      </div>

      {/* Pagination */}
      {filteredLogs.length > logsPerPage && (
        <div className="pagination-container">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="pagination-button"
          >
            Previous
          </button>
          {renderPageNumbers()}
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Logs;
