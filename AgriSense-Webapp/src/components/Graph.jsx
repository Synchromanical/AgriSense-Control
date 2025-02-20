// src/components/Graph.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

const Graph = () => {
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
        };
      });
      setSensorData(docs);
    });

    return () => unsub();
  }, []);

  // Build separate arrays
  const timestamps = [];
  const humidityData = [];
  const temperatureData = [];
  const lightData = [];
  const soilMoistureData = [];

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
    soilMoistureData.push(entry.soilMoisture);
    lightData.push(entry.light);
  });

  // Define colors
  const fieldColors = {
    humidity: "rgba(54, 162, 235, 1)",
    temperature: "rgba(255, 99, 132, 1)",
    light: "rgba(255, 206, 86, 1)",
    soilMoisture: "rgba(75, 192, 192, 1)",
  };

  // Build chartData
  let chartData;
  if (selectedField === "all") {
    chartData = {
      labels: timestamps,
      datasets: [
        {
          label: "Humidity (%)",
          data: humidityData,
          borderColor: fieldColors.humidity,
          borderWidth: 2,
          fill: false,
        },
        {
          label: "Temperature (°C)",
          data: temperatureData,
          borderColor: fieldColors.temperature,
          borderWidth: 2,
          fill: false,
        },
        {
          label: "Light (lux)",
          data: lightData,
          borderColor: fieldColors.light,
          borderWidth: 2,
          fill: false,
        },
        {
          label: "Soil Moisture (%)",
          data: soilMoistureData,
          borderColor: fieldColors.soilMoisture,
          borderWidth: 2,
          fill: false,
        },
      ],
    };
  } else {
    let labelName = "";
    let dataArr = [];
    let color = fieldColors.humidity;

    if (selectedField === "humidity") {
      labelName = "Humidity (%)";
      dataArr = humidityData;
      color = fieldColors.humidity;
    } else if (selectedField === "temperature") {
      labelName = "Temperature (°C)";
      dataArr = temperatureData;
      color = fieldColors.temperature;
    } else if (selectedField === "light") {
      labelName = "Light (lux)";
      dataArr = lightData;
      color = fieldColors.light;
    } else {
      labelName = "Soil Moisture (%)";
      dataArr = soilMoistureData;
      color = fieldColors.soilMoisture;
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
    <div className="content">
      <h2>Sensor Data Over Time</h2>

      <div className="graph-panel">
        <label>Select Data Type: </label>
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
        >
          <option value="all">Show All</option>
          <option value="humidity">Humidity (%)</option>
          <option value="temperature">Temperature (°C)</option>
          <option value="light">Light (lux)</option>
          <option value="soilMoisture">Soil Moisture (%)</option>
        </select>

        <div className="graph-container">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default Graph;
