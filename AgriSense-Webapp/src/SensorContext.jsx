import React, { createContext, useState, useEffect } from "react";

export const SensorContext = createContext();

export const SensorProvider = ({ children }) => {
  // Initialize activeSensors from localStorage if present.
  const [activeSensors, setActiveSensors] = useState(() => {
    const saved = localStorage.getItem("activeSensors");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("activeSensors", JSON.stringify(activeSensors));
  }, [activeSensors]);

  const addSensor = (sensor) => {
    if (sensor && !activeSensors.includes(sensor)) {
      setActiveSensors([...activeSensors, sensor]);
    }
  };

  const removeSensor = (sensor) => {
    setActiveSensors(activeSensors.filter((s) => s !== sensor));
  };

  const clearSensors = () => {
    setActiveSensors([]);
  };

  return (
    <SensorContext.Provider value={{ activeSensors, addSensor, removeSensor, clearSensors }}>
      {children}
    </SensorContext.Provider>
  );
};
