import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

const Graph = () => {
  const [sensorData, setSensorData] = useState([]);

  useEffect(() => {
    const fetchSensorData = async () => {
      const querySnapshot = await getDocs(collection(db, "sensorData"));
      const data = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setSensorData(data);
    };

    fetchSensorData();
  }, []);

  // Prepare data for chart.js
  const chartData = {
    labels: sensorData.map((entry) =>
      new Date(entry.timestamp).toLocaleTimeString()
    ),
    datasets: [
      {
        label: "Temperature (°C)",
        data: sensorData.map((entry) => entry.temperature),
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 2,
        fill: false,
      },
      {
        label: "Humidity (%)",
        data: sensorData.map((entry) => entry.humidity),
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 2,
        fill: false,
      },
      {
        label: "Light (lux)",
        data: sensorData.map((entry) => entry.light),
        borderColor: "rgba(255, 206, 86, 1)",
        borderWidth: 2,
        fill: false,
      },
      {
        label: "Soil Moisture (%)",
        data: sensorData.map((entry) => entry.soilMoisture),
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 2,
        fill: false,
      },
    ],
  };

  return (
    <div>
      <h2>Sensor Data Over Time</h2>
      <Line data={chartData} />
    </div>
  );
};

export default Graph;
