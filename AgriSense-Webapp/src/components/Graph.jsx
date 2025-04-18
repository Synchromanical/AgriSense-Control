// Graph.jsx
import React, { useState, useContext, useMemo } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import styles from "../Graph.module.css";
import { SensorContext } from "../SensorContext";
import { useDataContext } from "../DataContext";

// Map sensor names to their numeric Firestore field
const numericFieldMap = {
  "Temperature": "temperature",
  "Humidity": "humidity",
  "Soil Moisture": "soilMoisture",
  "Light 1": "light1",
  "Light 2": "light2",
  "Light 3": "light3",
  "Water Level": "waterLevel",
  "Nutrient 1 Level": "nutrient1",
  "Nutrient 2 Level": "nutrient2",
};

function Graph() {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const { dataState } = useDataContext();

  // Active sensors for this instance
  const sensors = activeSensors[selectedInstance] || [];

  // Filter only those sensors that correspond to a numeric field
  const numericSensors = sensors.filter((s) => numericFieldMap[s]);

  // By default, show "All Variables"
  const [selectedSensor, setSelectedSensor] = useState("allSensors");

  // The arrays of docs for each board
  const gsmDocs = dataState.gsmReadings;
  const hpcbDocs = dataState.hpcbReadings;
  const nscbDocs = dataState.nscbReadings;

  // Merge them to build a union of all timestamps (sorted ascending)
  const merged = useMemo(() => {
    return [...gsmDocs, ...hpcbDocs, ...nscbDocs].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [gsmDocs, hpcbDocs, nscbDocs]);

  // Build a sorted list of unique timestamps
  const unionTimestamps = useMemo(() => {
    const setOfT = new Set();
    merged.forEach((d) => {
      if (d.timestamp) {
        setOfT.add(new Date(d.timestamp).getTime());
      }
    });
    return Array.from(setOfT)
      .sort((a, b) => a - b)
      .map((t) => new Date(t));
  }, [merged]);

  // Helper to fill-forward numeric data for a given field
  const fillForward = (docs, field) => {
    const sorted = [...docs].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
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

  // Pre-build data arrays for all possible numeric fields
  const temperatureData = fillForward(gsmDocs, "temperature");
  const humidityData = fillForward(gsmDocs, "humidity");
  const soilMoistureData = fillForward(gsmDocs, "soilMoisture");
  const light1Data = fillForward(hpcbDocs, "light1");
  const light2Data = fillForward(hpcbDocs, "light2");
  const light3Data = fillForward(hpcbDocs, "light3");
  const waterLevelData = fillForward(nscbDocs, "waterLevel");
  const nutrient1Data = fillForward(nscbDocs, "nutrient1");
  const nutrient2Data = fillForward(nscbDocs, "nutrient2");

  // Make a lookup so we can easily retrieve the correct array
  const allFieldDataMap = {
    temperature: temperatureData,
    humidity: humidityData,
    soilMoisture: soilMoistureData,
    light1: light1Data,
    light2: light2Data,
    light3: light3Data,
    waterLevel: waterLevelData,
    nutrient1: nutrient1Data,
    nutrient2: nutrient2Data,
  };

  const fieldColors = {
    temperature: "rgba(255, 99, 132, 1)",
    humidity: "rgba(54, 162, 235, 1)",
    soilMoisture: "rgba(75, 192, 192, 1)",
    light1: "rgba(255, 206, 86, 1)",
    light2: "rgba(255, 159, 64, 1)",
    light3: "rgba(153, 102, 255, 1)",
    waterLevel: "rgba(255, 99, 255, 1)",
    nutrient1: "rgba(40, 180, 100, 1)",
    nutrient2: "rgba(150, 70, 190, 1)",
  };

  // Build "datasets" depending on selectedSensor
  let chartDatasets = [];

  if (selectedSensor === "allSensors") {
    // One line for each numeric sensor that is active
    chartDatasets = numericSensors.map((sensorName) => {
      const fieldName = numericFieldMap[sensorName];
      return {
        label: sensorName,
        data: allFieldDataMap[fieldName],
        borderColor: fieldColors[fieldName] || "#fff",
        borderWidth: 2,
        fill: false,
      };
    });
  } else if (selectedSensor) {
    // Single line
    const fieldName = numericFieldMap[selectedSensor];
    chartDatasets = [
      {
        label: selectedSensor,
        data: allFieldDataMap[fieldName],
        borderColor: fieldColors[fieldName] || "#fff",
        borderWidth: 2,
        fill: false,
      },
    ];
  }

  const labels = unionTimestamps.map((ts) =>
    ts.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " " +
    ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );

  const chartData = {
    labels,
    datasets: chartDatasets,
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
        <label>Select Variable to Graph: </label>
        <select
          value={selectedSensor}
          onChange={(e) => setSelectedSensor(e.target.value)}
        >
          <option value="allSensors">All Variables</option>
          {numericSensors.map((sensorName) => (
            <option key={sensorName} value={sensorName}>
              {sensorName}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.graphPanel}>
        <div className={styles.graphContainer}>
          {unionTimestamps.length === 0 ? (
            <p>No data available for this instance.</p>
          ) : chartDatasets.length === 0 ? (
            <p>Please select a sensor above to see its graph.</p>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Graph;
