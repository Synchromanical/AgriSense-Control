import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs } from "firebase/firestore";

function SensorData() {
  const [sensorData, setSensorData] = useState([]);

  // Function to fetch sensor data from Firestore
  const fetchSensorData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "sensors"));
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSensorData(data);
    } catch (error) {
      console.error("Error fetching sensor data:", error);
    }
  };

  // Function to add a new sensor reading
  const addSensorReading = async () => {
    try {
      await addDoc(collection(db, "sensors"), {
        sensorName: "Temperature",
        value: Math.floor(Math.random() * 100),
        timestamp: new Date(),
      });
      alert("Sensor data added!");
      fetchSensorData(); // Refresh data
    } catch (error) {
      console.error("Error adding document:", error);
    }
  };

  useEffect(() => {
    fetchSensorData();
  }, []);

  return (
    <div>
      <h2>Sensor Readings</h2>
      <button onClick={addSensorReading}>Add Sensor Data</button>
      <ul>
        {sensorData.map((sensor) => (
          <li key={sensor.id}>
            {sensor.sensorName}: {sensor.value} (Timestamp:{" "}
            {sensor.timestamp?.toDate().toLocaleString()})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SensorData;
