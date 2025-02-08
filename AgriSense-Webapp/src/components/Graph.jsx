import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

const Graph = () => {
  const [sensorData, setSensorData] = useState([]);
  const [selectedField, setSelectedField] = useState("all"); // Default to showing all datasets

  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "sensorData"));
        const fetchedData = querySnapshot.docs.map((doc) => doc.data());
        setSensorData(fetchedData);
      } catch (error) {
        console.error("Error fetching Firestore data:", error);
      }
    };

    fetchSensorData();
  }, []);

  // Extract timestamps and data for each field
  let timestamps = [];
  let humidityData = [];
  let temperatureData = [];
  let lightData = [];
  let soilMoistureData = [];

  sensorData.forEach((entry) => {
    if (entry.timestamp) {
      timestamps = timestamps.concat(
        entry.timestamp.map((ts) => {
          const date = new Date(ts);
          return isNaN(date)
            ? "Invalid Date"
            : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
              " " +
              date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        })
      );
    }
    if (entry.humidity) humidityData = humidityData.concat(entry.humidity);
    if (entry.temperature) temperatureData = temperatureData.concat(entry.temperature);
    if (entry.light) lightData = lightData.concat(entry.light);
    if (entry.soilMoisture) soilMoistureData = soilMoistureData.concat(entry.soilMoisture);
  });

  // Filter out invalid dates
  timestamps = timestamps.filter((ts) => ts !== "Invalid Date");

  // Ensure all datasets align with the timestamps array length
  const minLength = Math.min(
    timestamps.length,
    humidityData.length,
    temperatureData.length,
    lightData.length,
    soilMoistureData.length
  );
  timestamps = timestamps.slice(0, minLength);
  humidityData = humidityData.slice(0, minLength);
  temperatureData = temperatureData.slice(0, minLength);
  lightData = lightData.slice(0, minLength);
  soilMoistureData = soilMoistureData.slice(0, minLength);

  // Define colors for different datasets
  const fieldColors = {
    humidity: "rgba(54, 162, 235, 1)",
    temperature: "rgba(255, 99, 132, 1)",
    light: "rgba(255, 206, 86, 1)",
    soilMoisture: "rgba(75, 192, 192, 1)",
  };

  // Chart.js Data Configuration
  const chartData = {
    labels: timestamps,
    datasets:
      selectedField === "all"
        ? [
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
          ]
        : [
            {
              label: `${selectedField.charAt(0).toUpperCase() + selectedField.slice(1)} Data`,
              data:
                selectedField === "humidity"
                  ? humidityData
                  : selectedField === "temperature"
                  ? temperatureData
                  : selectedField === "light"
                  ? lightData
                  : soilMoistureData,
              borderColor: fieldColors[selectedField],
              borderWidth: 2,
              fill: false,
            },
          ],
  };

  // Chart.js Options - Formatting the X-Axis
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#ffffff", // White text for better readability
        },
      },
      tooltip: {
        enabled: true, // Ensure tooltips are enabled
        mode: "nearest", // Show data for the nearest point
        intersect: false, // Allow hovering over multiple points
        backgroundColor: "rgba(0, 0, 0, 0.8)", // Dark background for visibility
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        padding: 10,
        cornerRadius: 6,
      },
    },
    hover: {
      mode: "nearest",
      intersect: false,
    },
    scales: {
      x: {
        ticks: {
          color: "#ffffff", // White text for better readability
          maxRotation: 45, // Rotate labels for better spacing
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
      <label>Select Data Type: </label>
      <select value={selectedField} onChange={(e) => setSelectedField(e.target.value)}>
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
  );
};

export default Graph;
