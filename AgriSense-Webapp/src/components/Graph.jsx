// Graph.jsx
import React, { useState, useContext, useMemo } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import styles from "../Graph.module.css";
import { SensorContext } from "../SensorContext";
import { useDataContext } from "../DataContext";

function Graph() {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const { dataState } = useDataContext();

  const sensors = activeSensors[selectedInstance] || [];
  const [selectedField, setSelectedField] = useState("all");

  // The arrays of docs for each board
  const gsmDocs = dataState.gsmReadings;
  const hpcbDocs = dataState.hpcbReadings;
  const nscbDocs = dataState.nscbReadings;

  // Merge them to build a union of timestamps
  const merged = useMemo(() => [...gsmDocs, ...hpcbDocs, ...nscbDocs].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  ), [gsmDocs, hpcbDocs, nscbDocs]);

  const unionTimestamps = useMemo(() => {
    const setOfT = new Set();
    merged.forEach((d) => {
      if (d.timestamp) setOfT.add(new Date(d.timestamp).getTime());
    });
    return Array.from(setOfT)
      .sort((a, b) => a - b)
      .map((t) => new Date(t));
  }, [merged]);

  // Helper to build an array of numeric data for one field, filled forward
  const fillForward = (docs, field) => {
    const sorted = [...docs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const result = [];
    let idx = 0;
    let lastVal = null;
    for (const ts of unionTimestamps) {
      while (idx < sorted.length && new Date(sorted[idx].timestamp) <= ts) {
        if (sorted[idx][field] !== undefined) {
          const val = parseFloat(sorted[idx][field]);
          if (!isNaN(val)) lastVal = val;
        }
        idx++;
      }
      result.push(lastVal);
    }
    return result;
  };

  const temperatureData = fillForward(gsmDocs, "temperature");
  const humidityData = fillForward(gsmDocs, "humidity");
  const soilMoistureData = fillForward(gsmDocs, "soilMoisture");
  const light1Data = fillForward(hpcbDocs, "light1");
  const light2Data = fillForward(hpcbDocs, "light2");
  const light3Data = fillForward(hpcbDocs, "light3");
  const waterLevelData = fillForward(nscbDocs, "waterLevel");

  const labels = unionTimestamps.map((ts) =>
    ts.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " " +
    ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );

  const fieldColors = {
    temperature: "rgba(255, 99, 132, 1)",
    humidity: "rgba(54, 162, 235, 1)",
    soilMoisture: "rgba(75, 192, 192, 1)",
    light1: "rgba(255, 206, 86, 1)",
    light2: "rgba(255, 159, 64, 1)",
    light3: "rgba(153, 102, 255, 1)",
    waterLevel: "rgba(255, 99, 255, 1)",
  };

  let datasets = [];
  if (selectedField === "all") {
    if (sensors.includes("Temperature")) {
      datasets.push({
        label: "Temperature (°C)",
        data: temperatureData,
        borderColor: fieldColors.temperature,
      });
    }
    if (sensors.includes("Humidity")) {
      datasets.push({
        label: "Humidity (%)",
        data: humidityData,
        borderColor: fieldColors.humidity,
      });
    }
    if (sensors.includes("Soil Moisture")) {
      datasets.push({
        label: "Soil Moisture (%)",
        data: soilMoistureData,
        borderColor: fieldColors.soilMoisture,
      });
    }
    if (sensors.includes("Light 1")) {
      datasets.push({
        label: "Light 1 (lux)",
        data: light1Data,
        borderColor: fieldColors.light1,
      });
    }
    if (sensors.includes("Light 2")) {
      datasets.push({
        label: "Light 2 (lux)",
        data: light2Data,
        borderColor: fieldColors.light2,
      });
    }
    if (sensors.includes("Light 3")) {
      datasets.push({
        label: "Light 3 (lux)",
        data: light3Data,
        borderColor: fieldColors.light3,
      });
    }
    if (sensors.includes("Water Level")) {
      datasets.push({
        label: "Water Level (%)",
        data: waterLevelData,
        borderColor: fieldColors.waterLevel,
      });
    }
  } else {
    // If a single field is chosen
    // ...
  }

  const chartData = {
    labels,
    datasets: datasets.map((ds) => ({
      ...ds,
      borderWidth: 2,
      fill: false,
    })),
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: "#ffffff" } },
    },
    scales: {
      x: { ticks: { color: "#ffffff" } },
      y: { ticks: { color: "#ffffff" } },
    },
  };

  return (
    <div className={styles.content}>
      <h2>Sensor Data Graph</h2>
      <div style={{ marginBottom: "1rem" }}>
        <label>Select Field to Graph: </label>
        <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
          <option value="all">All (multi-line)</option>
          <option value="Temperature">Temperature</option>
          <option value="Humidity">Humidity</option>
          <option value="Soil Moisture">Soil Moisture</option>
          <option value="Light 1">Light 1</option>
          <option value="Light 2">Light 2</option>
          <option value="Light 3">Light 3</option>
          <option value="Water Level">Water Level</option>
        </select>
      </div>
      <div className={styles.graphPanel}>
        <div className={styles.graphContainer}>
          {unionTimestamps.length === 0 ? (
            <p>No data available for the selected sensors.</p>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Graph;
