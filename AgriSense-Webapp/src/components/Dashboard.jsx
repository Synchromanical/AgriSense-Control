import React, { useState } from "react";

function Dashboard() {
  const [temperature, setTemperature] = useState(55);
  const [humidity, setHumidity] = useState(55);
  const [soilMoisture, setSoilMoisture] = useState(55);
  const [light, setLight] = useState(true);

  return (
    <div>
      <h2>Dashboard</h2>
      <div>
        <label>Temperature: </label>
        <input
          type="number"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        />
      </div>
      <div>
        <label>Humidity: </label>
        <input
          type="number"
          value={humidity}
          onChange={(e) => setHumidity(e.target.value)}
        />
      </div>
      <div>
        <label>Soil Moisture: </label>
        <input
          type="number"
          value={soilMoisture}
          onChange={(e) => setSoilMoisture(e.target.value)}
        />
      </div>
    </div>
  );
}

export default Dashboard;
