// Logs.jsx
import React, { useContext, useRef, useState } from "react";
import styles from "../Logs.module.css";
import { SensorContext } from "../SensorContext";
import { useDataContext } from "../DataContext";

const Logs = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const { dataState, importLogs, clearLogs } = useDataContext();

  const sensors = activeSensors[selectedInstance] || [];
  const allLogs = dataState.mergedLogs;

  // Logs filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const fileInputRef = useRef(null);

  // Filter to only logs relevant to these sensors
  const relevantLogs = sensors.length
    ? allLogs.filter((log) =>
        sensors.some((s) => log.action.toLowerCase().includes(s.toLowerCase()))
      )
    : [];

  // Then apply text/time filters
  const filteredLogs = relevantLogs.filter((log) => {
    const textMatch =
      !searchTerm ||
      log.id.toString().includes(searchTerm) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    if (!textMatch) return false;

    const t = log.time.getTime();
    if (startTime) {
      const st = new Date(startTime).getTime();
      if (t < st) return false;
    }
    if (endTime) {
      const et = new Date(endTime).getTime();
      if (t > et) return false;
    }
    return true;
  });

  // Simple pagination
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 25;
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

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

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
    }
  };
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleImportLogs = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        await importLogs(imported, sensors);
      } catch (err) {
        console.error("Error parsing imported logs", err);
      }
    };
    reader.readAsText(file);
  };

  const handleExportLogs = () => {
    const exportData = relevantLogs.map((log) => ({
      id: log.id,
      time: log.time.toISOString(),
      action: log.action,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "logs.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = async () => {
    await clearLogs(sensors);
  };

  return (
    <div className={styles.content}>
      <h2>All Logs</h2>
      {!sensors.length ? (
        <p>Please select a sensor in the Sensor tab to view logs.</p>
      ) : (
        <>
          <div className={styles.logsContainer}>
            <div className={styles.logsFilters}>
              <div className={styles.logsTimeSearch}>
                <div className={styles.logsTimeTitle}>Search Between</div>
                <div className={styles.logsTimeInputs}>
                  <div className={styles.logsTimeGroup}>
                    <label className={styles.logsTimeLabel}>Start</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setCurrentPage(1);
                      }}
                      className={styles.logsTimeInput}
                    />
                  </div>
                  <div className={styles.logsTimeGroup}>
                    <label className={styles.logsTimeLabel}>End</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        setCurrentPage(1);
                      }}
                      className={styles.logsTimeInput}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.logsTextSearch}>
                <label className={styles.logsSearchLabel}>Search</label>
                <input
                  type="text"
                  placeholder="Search by ID or Action..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
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
