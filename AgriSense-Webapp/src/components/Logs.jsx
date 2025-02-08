import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const logsPerPage = 25;
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "sensorData"));
        const logsData = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const timestampArray = data.timestamp; // Array of timestamps

          // Push individual sensor readings as separate rows
          const addLogEntry = (sensorType, values) => {
            if (Array.isArray(values) && Array.isArray(timestampArray)) {
              values.forEach((value, index) => {
                if (timestampArray[index]) {
                  logsData.push({
                    // Temporary ID; will be reset after sorting
                    id: logsData.length + 1,
                    // Store the original Date for filtering
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

        // Sort logs by time in ascending order (earliest first)
        logsData.sort((a, b) => a.time - b.time);

        // Create a new array with formatted time for display and keep the original Date in "originalTime"
        const formattedLogs = logsData.map((log, index) => ({
          ...log,
          id: index + 1,
          originalTime: log.time,
          time: log.time.toLocaleString(),
        }));

        setLogs(formattedLogs);
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    };

    fetchLogs();
  }, []);

  // Filter logs based on text search and time range
  const filteredLogs = logs.filter((log) => {
    // Text filter (by ID or Action)
    const textMatch =
      searchTerm === "" ||
      log.id.toString().includes(searchTerm) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());

    // Time filter: if startTime/endTime is provided, convert to Date for comparison
    let timeMatch = true;
    if (startTime) {
      const startDate = new Date(startTime);
      timeMatch = timeMatch && log.originalTime >= startDate;
    }
    if (endTime) {
      const endDate = new Date(endTime);
      timeMatch = timeMatch && log.originalTime <= endDate;
    }

    return textMatch && timeMatch;
  });

  // Reset current page to 1 when any search filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startTime, endTime]);

  // Pagination calculation based on filtered logs
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  // Handlers for pagination buttons
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Render page numbers for direct navigation
  const renderPageNumbers = () => {
    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`pagination-button ${currentPage === i ? "active" : ""}`}
        >
          {i}
        </button>
      );
    }
    return pageNumbers;
  };

  // Export logs as a JSON file
  const handleExportLogs = () => {
    const json = JSON.stringify(logs, null, 2);
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

  // Import logs from a JSON file
  const handleImportLogs = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedLogs = JSON.parse(event.target.result);
        // Optionally, process the imported logs before updating state.
        setLogs(importedLogs);
      } catch (error) {
        console.error("Error parsing imported file", error);
      }
    };
    reader.readAsText(file);
  };

  // Clear logs from the local state
  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="content">
      <h2>All Logs</h2>
      <div className="logs-container">
        <div className="logs-filters">
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
