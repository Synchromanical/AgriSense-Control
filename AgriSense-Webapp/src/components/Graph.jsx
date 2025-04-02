import React, { useEffect, useState, useContext, useMemo } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import styles from "../Graph.module.css";
import { SensorContext } from "../SensorContext";

/*
  We'll create line-series for:
  - Temperature (if user has chosen Temperature)
  - Humidity
  - Soil Moisture
  - Light 1, Light 2, Light 3
  - Water Level
  (We skip fans/humidifiers here since they're boolean states, not numeric.)
*/

const Graph = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];
  const [mergedData, setMergedData] = useState([]);
  const [selectedField, setSelectedField] = useState("all");

  /*
    1) Figure out which boards we need to listen to (GSMB/HPCB/NSCB)
    2) Merge all docs (ordered by ascending timestamp).
  */
  useEffect(() => {
    const boardsNeeded = new Set();
    sensors.forEach((sensor) => {
      const lower = sensor.toLowerCase();
      if (
        lower.includes("temperature") ||
        lower.includes("humidity") ||
        lower.includes("soil")
      ) {
        boardsNeeded.add("GSMB");
      }
      if (
        sensor.startsWith("Light ") // includes "Light 1", "Light 2", "Light 3"
      ) {
        boardsNeeded.add("HPCB");
      }
      if (lower.includes("water")) {
        boardsNeeded.add("NSCB");
      }
      // If you want to chart other numeric fields, add them similarly
    });

    const unsubscribes = [];
    const dataByCollection = {};

    boardsNeeded.forEach((colName) => {
      dataByCollection[colName] = [];
      const q = query(collection(db, colName), orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        dataByCollection[colName] = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          boardType: colName,
        }));
        // Merge everything
        const merged = Object.values(dataByCollection).flat();
        merged.sort((a, b) => {
          const tA = new Date(a.timestamp).getTime();
          const tB = new Date(b.timestamp).getTime();
          return tA - tB;
        });
        setMergedData(merged);
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach((u) => u());
  }, [sensors]);

  // Create a union of all timestamps from mergedData, sorted ascending
  const unionTimestamps = useMemo(() => {
    const tsSet = new Set();
    mergedData.forEach((doc) => {
      if (doc.timestamp) {
        const t = new Date(doc.timestamp).getTime();
        tsSet.add(t);
      }
    });
    const tsArray = Array.from(tsSet).sort((a, b) => a - b).map((t) => new Date(t));
    return tsArray;
  }, [mergedData]);

  // Helper to fill forward a numeric field over the unionTimestamps
  const fillForward = (docs, field) => {
    const sorted = [...docs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const result = [];
    let idx = 0;
    let lastVal = null;
    for (const ts of unionTimestamps) {
      while (idx < sorted.length && new Date(sorted[idx].timestamp) <= ts) {
        if (sorted[idx][field] !== undefined) {
          const val = parseFloat(sorted[idx][field]);
          if (!isNaN(val)) {
            lastVal = val;
          }
        }
        idx++;
      }
      result.push(lastVal !== null ? lastVal : null);
    }
    return result;
  };

  // Separate docs by board
  const gsmDocs = mergedData.filter((doc) => doc.boardType === "GSMB");
  const hpcbDocs = mergedData.filter((doc) => doc.boardType === "HPCB");
  const nscbDocs = mergedData.filter((doc) => doc.boardType === "NSCB");

  // Build numeric arrays
  const temperatureData = fillForward(
    gsmDocs.filter((d) => d.temperature !== undefined),
    "temperature"
  );
  const humidityData = fillForward(
    gsmDocs.filter((d) => d.humidity !== undefined),
    "humidity"
  );
  const soilMoistureData = fillForward(
    gsmDocs.filter((d) => d.soilMoisture !== undefined),
    "soilMoisture"
  );
  const light1Data = fillForward(
    hpcbDocs.filter((d) => d.light1 !== undefined),
    "light1"
  );
  const light2Data = fillForward(
    hpcbDocs.filter((d) => d.light2 !== undefined),
    "light2"
  );
  const light3Data = fillForward(
    hpcbDocs.filter((d) => d.light3 !== undefined),
    "light3"
  );
  const waterLevelData = fillForward(
    nscbDocs.filter((d) => d.waterLevel !== undefined),
    "waterLevel"
  );

  // x-axis labels
  const labels = unionTimestamps.map((ts) =>
    ts.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
      " " +
      ts.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
  );

  // Some arbitrary colors for the lines
  const fieldColors = {
    temperature: "rgba(255, 99, 132, 1)",
    humidity: "rgba(54, 162, 235, 1)",
    soilMoisture: "rgba(75, 192, 192, 1)",
    light1: "rgba(255, 206, 86, 1)",
    light2: "rgba(255, 159, 64, 1)",
    light3: "rgba(153, 102, 255, 1)",
    waterLevel: "rgba(255, 99, 255, 1)",
  };

  // Build the Chart.js datasets based on which fields the user selected
  let datasets = [];

  // If "all" is selected, we plot everything relevant to the active sensors
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
        borderColor: fieldColors.soilMoisture,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Light 1")) {
      datasets.push({
        label: "Light 1 (lux)",
        data: light1Data,
        borderColor: fieldColors.light1,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Light 2")) {
      datasets.push({
        label: "Light 2 (lux)",
        data: light2Data,
        borderColor: fieldColors.light2,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Light 3")) {
      datasets.push({
        label: "Light 3 (lux)",
        data: light3Data,
        borderColor: fieldColors.light3,
        borderWidth: 2,
        fill: false,
      });
    }
    if (sensors.includes("Water Level")) {
      datasets.push({
        label: "Water Level (%)",
        data: waterLevelData,
        borderColor: fieldColors.waterLevel,
        borderWidth: 2,
        fill: false,
      });
    }
  } else {
    // If user picks a specific field in "selectedField", plot only that one
    // We'll match "Temperature", "Humidity", etc.
    const lowerField = selectedField.toLowerCase();
    let dataArr = [];
    let labelName = "";
    let color = "rgba(0, 0, 0, 1)";

    if (lowerField.includes("temperature")) {
      labelName = "Temperature (°C)";
      dataArr = temperatureData;
      color = fieldColors.temperature;
    } else if (lowerField.includes("humidity")) {
      labelName = "Humidity (%)";
      dataArr = humidityData;
      color = fieldColors.humidity;
    } else if (lowerField.includes("soil")) {
      labelName = "Soil Moisture (%)";
      dataArr = soilMoistureData;
      color = fieldColors.soilMoisture;
    } else if (lowerField.includes("light 1")) {
      labelName = "Light 1 (lux)";
      dataArr = light1Data;
      color = fieldColors.light1;
    } else if (lowerField.includes("light 2")) {
      labelName = "Light 2 (lux)";
      dataArr = light2Data;
      color = fieldColors.light2;
    } else if (lowerField.includes("light 3")) {
      labelName = "Light 3 (lux)";
      dataArr = light3Data;
      color = fieldColors.light3;
    } else if (lowerField.includes("water")) {
      labelName = "Water Level (%)";
      dataArr = waterLevelData;
      color = fieldColors.waterLevel;
    }

    datasets.push({
      label: labelName,
      data: dataArr,
      borderColor: color,
      borderWidth: 2,
      fill: false,
    });
  }

  const chartData = {
    labels,
    datasets,
  };

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
      <h2>Sensor Data Graph</h2>
      {/* Field selection: let the user pick "all" or a single field to chart */}
      <div style={{ marginBottom: "1rem" }}>
        <label>Select Field to Graph: </label>
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
        >
          <option value="all">All (multi-line)</option>
          {/* You can list out the rest or rely on user to type */}
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
          {/* If we have no data, display a message */}
          {unionTimestamps.length === 0 ? (
            <p>No data available for the selected sensors.</p>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Graph;
