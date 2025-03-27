import React, { useEffect, useState, useContext, useMemo } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import styles from "../Graph.module.css";
import { SensorContext } from "../SensorContext";

const sensorMapping = {
  temperature: { collection: "GSMB", field: "temperature" },
  humidity: { collection: "GSMB", field: "humidity" },
  soilmoisture: { collection: "GSMB", field: "soilMoisture" },
  light: { collection: "HPCB", field: "light" },
  waterlevel: { collection: "NSCB", field: "waterLevel" },
};

const Graph = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];
  const [mergedData, setMergedData] = useState([]);
  const [selectedField, setSelectedField] = useState("all");

  // Subscribe to all relevant collections based on active sensors.
  useEffect(() => {
    const collectionsNeeded = {};
    sensors.forEach((sensor) => {
      const key = sensor.toLowerCase().replace(/\s/g, "");
      if (sensorMapping[key]) {
        collectionsNeeded[sensorMapping[key].collection] = true;
      }
    });
    const unsubscribes = [];
    const dataByCollection = {};
    Object.keys(collectionsNeeded).forEach((colName) => {
      dataByCollection[colName] = [];
      const q = query(collection(db, colName), orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        dataByCollection[colName] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          boardType: colName, // tag document with its board/collection
        }));
        const merged = Object.values(dataByCollection).flat();
        merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setMergedData(merged);
      });
      unsubscribes.push(unsubscribe);
    });
    return () => unsubscribes.forEach((u) => u());
  }, [sensors]);

  // Create a union of all timestamps (sorted)
  const unionTimestamps = useMemo(() => {
    const tsSet = new Set();
    mergedData.forEach((doc) => {
      if (doc.timestamp) {
        tsSet.add(doc.timestamp);
      }
    });
    const tsArray = Array.from(tsSet).map((ts) => new Date(ts));
    tsArray.sort((a, b) => a - b);
    return tsArray;
  }, [mergedData]);

  // Utility function: fill forward sensor values over unionTimestamps.
  const fillForward = (docs, sensorField, unionTimestamps) => {
    let result = [];
    const sortedDocs = docs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let idx = 0;
    let lastValue = null;
    for (const ts of unionTimestamps) {
      while (idx < sortedDocs.length && new Date(sortedDocs[idx].timestamp) <= ts) {
        lastValue = sortedDocs[idx][sensorField];
        idx++;
      }
      result.push(lastValue);
    }
    return result;
  };

  // Filter merged data by board type.
  const gsmDocs = mergedData.filter((doc) => doc.boardType === "GSMB");
  const hpcbDocs = mergedData.filter((doc) => doc.boardType === "HPCB");
  const nscDocs = mergedData.filter((doc) => doc.boardType === "NSCB");

  const temperatureData = fillForward(
    gsmDocs.filter((doc) => doc.temperature !== undefined),
    "temperature",
    unionTimestamps
  );
  const humidityData = fillForward(
    gsmDocs.filter((doc) => doc.humidity !== undefined),
    "humidity",
    unionTimestamps
  );
  const soilMoistureData = fillForward(
    gsmDocs.filter((doc) => doc.soilMoisture !== undefined),
    "soilMoisture",
    unionTimestamps
  );
  const lightData = fillForward(
    hpcbDocs.filter((doc) => doc.light !== undefined),
    "light",
    unionTimestamps
  );
  const waterLevelData = fillForward(
    nscDocs.filter((doc) => doc.waterLevel !== undefined),
    "waterLevel",
    unionTimestamps
  );

  // Build x-axis labels from unionTimestamps.
  const labels = unionTimestamps.map((ts) =>
    ts.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
      " " +
      ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );

  // Build datasets based on selectedField.
  const fieldColors = {
    temperature: "rgba(255, 99, 132, 1)",
    humidity: "rgba(54, 162, 235, 1)",
    soilmoisture: "rgba(75, 192, 192, 1)",
    light: "rgba(255, 206, 86, 1)",
    waterlevel: "rgba(153, 102, 255, 1)",
  };

  let datasets = [];
  if (selectedField === "all") {
    if (sensors.includes("Temperature")) {
      datasets.push({
        label: "Temperature (°C)",
        data: temperatureData,
        borderColor: fieldColors.temperature,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Humidity")) {
      datasets.push({
        label: "Humidity (%)",
        data: humidityData,
        borderColor: fieldColors.humidity,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Soil Moisture")) {
      datasets.push({
        label: "Soil Moisture (%)",
        data: soilMoistureData,
        borderColor: fieldColors.soilmoisture,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Light")) {
      datasets.push({
        label: "Light (lux)",
        data: lightData,
        borderColor: fieldColors.light,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Water Level")) {
      datasets.push({
        label: "Water Level (%)",
        data: waterLevelData,
        borderColor: fieldColors.waterlevel,
        borderWidth: 2,
        fill: false,
      });
    }
  } else {
    const key = selectedField.toLowerCase().replace(/\s/g, "");
    let labelName = "";
    let dataArr = [];
    let color = "";
    switch (key) {
      case "temperature":
        labelName = "Temperature (°C)";
        dataArr = temperatureData;
        color = fieldColors.temperature;
        break;
      case "humidity":
        labelName = "Humidity (%)";
        dataArr = humidityData;
        color = fieldColors.humidity;
        break;
      case "soilmoisture":
        labelName = "Soil Moisture (%)";
        dataArr = soilMoistureData;
        color = fieldColors.soilmoisture;
        break;
      case "light":
        labelName = "Light (lux)";
        dataArr = lightData;
        color = fieldColors.light;
        break;
      case "waterlevel":
        labelName = "Water Level (%)";
        dataArr = waterLevelData;
        color = fieldColors.waterlevel;
        break;
      default:
        break;
    }
    if (dataArr.length) {
      datasets.push({
        label: labelName,
        data: dataArr,
        borderColor: color,
        borderWidth: 2,
        fill: false,
      });
    }
  }

  const chartData = { labels, datasets };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#ffffff",
        },
      },
      tooltip: {
        enabled: true,
        mode: "nearest",
        intersect: false,
        backgroundColor: "rgba(0,0,0,0.8)",
      },
    },
    hover: {
      mode: "nearest",
      intersect: false,
    },
    scales: {
      x: {
        ticks: {
          color: "#ffffff",
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        ticks: {
          color: "#ffffff",
        },
      },
    },
  };

  return (
    <div className={styles.content}>
      <h2>Sensor Data Over Time</h2>
      {sensors.length === 0 ? (
        <p>Please select a sensor in the Sensor tab to view graphs.</p>
      ) : (
        <div className={styles.graphPanel}>
          <div style={{ marginBottom: "10px" }}>
            <label style={{ marginRight: "10px" }}>Select Data Type:</label>
            <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
              <option value="all">Show All</option>
              {sensors.map((sensor) => (
                <option key={sensor} value={sensor}>
                  {sensor}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.graphContainer}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Graph;
