import React, { useEffect, useState, useContext } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import styles from "../Graph.module.css";
import { SensorContext } from "../SensorContext";

const Graph = () => {
  const { activeSensors, selectedInstance } = useContext(SensorContext);
  const sensors = activeSensors[selectedInstance] || [];
  const [sensorData, setSensorData] = useState([]);
  const [selectedField, setSelectedField] = useState("all");

  useEffect(() => {
    const q = query(collection(db, "sensorData"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          timestamp: data.timestamp,
          temperature: data.temperature,
          humidity: data.humidity,
          soilMoisture: data.soilMoisture,
          light: data.light,
          waterLevel: data.waterLevel,
        };
      });
      setSensorData(docs);
    });
    return () => unsub();
  }, []);

  const timestamps = [];
  const humidityData = [];
  const temperatureData = [];
  const lightData = [];
  const soilMoistureData = [];
  const waterLevelData = [];

  sensorData.forEach((entry) => {
    let ts = entry.timestamp;
    if (ts && typeof ts === "string") {
      ts = new Date(ts);
    } else {
      ts = new Date(0);
    }
    const label =
      ts.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }) +
      " " +
      ts.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    timestamps.push(label);
    humidityData.push(entry.humidity);
    temperatureData.push(entry.temperature);
    lightData.push(entry.light);
    soilMoistureData.push(entry.soilMoisture);
    waterLevelData.push(entry.waterLevel);
  });

  const fieldColors = {
    humidity: "rgba(54, 162, 235, 1)",
    temperature: "rgba(255, 99, 132, 1)",
    light: "rgba(255, 206, 86, 1)",
    soilMoisture: "rgba(75, 192, 192, 1)",
    waterLevel: "rgba(153, 102, 255, 1)",
  };

  let chartData;
  if (selectedField === "all") {
    const datasets = [];
    sensors.forEach((sensor) => {
      let labelName = "";
      let dataArr = [];
      let color = "";
      switch (sensor) {
        case "Temperature":
          labelName = "Temperature (°C)";
          dataArr = temperatureData;
          color = fieldColors.temperature;
          break;
        case "Humidity":
          labelName = "Humidity (%)";
          dataArr = humidityData;
          color = fieldColors.humidity;
          break;
        case "Soil Moisture":
          labelName = "Soil Moisture (%)";
          dataArr = soilMoistureData;
          color = fieldColors.soilMoisture;
          break;
        case "Light":
          labelName = "Light (lux)";
          dataArr = lightData;
          color = fieldColors.light;
          break;
        case "Water Level":
          labelName = "Water Level (%)";
          dataArr = waterLevelData;
          color = fieldColors.waterLevel;
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
    });
    chartData = { labels: timestamps, datasets };
  } else {
    let sensorName = selectedField;
    let labelName = "";
    let dataArr = [];
    let color = "";
    switch (sensorName) {
      case "Temperature":
        labelName = "Temperature (°C)";
        dataArr = temperatureData;
        color = fieldColors.temperature;
        break;
      case "Humidity":
        labelName = "Humidity (%)";
        dataArr = humidityData;
        color = fieldColors.humidity;
        break;
      case "Soil Moisture":
        labelName = "Soil Moisture (%)";
        dataArr = soilMoistureData;
        color = fieldColors.soilMoisture;
        break;
      case "Light":
        labelName = "Light (lux)";
        dataArr = lightData;
        color = fieldColors.light;
        break;
      case "Water Level":
        labelName = "Water Level (%)";
        dataArr = waterLevelData;
        color = fieldColors.waterLevel;
        break;
      default:
        break;
    }
    chartData = {
      labels: timestamps,
      datasets: [
        {
          label: labelName,
          data: dataArr,
          borderColor: color,
          borderWidth: 2,
          fill: false,
        },
      ],
    };
  }

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
          <label>Select Data Type: </label>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
          >
            <option value="all">Show All</option>
            {sensors.map((sensor) => (
              <option key={sensor} value={sensor}>
                {sensor}
              </option>
            ))}
          </select>
          <div className={styles.graphContainer}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Graph;
