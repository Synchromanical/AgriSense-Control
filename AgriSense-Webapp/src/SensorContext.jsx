import React, { createContext, useState, useEffect } from "react";

export const SensorContext = createContext();

export const SensorProvider = ({ children }) => {
  // Store sensors separately by instance (node 1 and node 2)
  const [activeSensors, setActiveSensors] = useState(() => {
    const saved = localStorage.getItem("activeSensors");
    return saved ? JSON.parse(saved) : { "1": [], "2": [] };
  });

  // Global selected instance (node) used to display data across tabs
  const [selectedInstance, setSelectedInstance] = useState(() => {
    const saved = localStorage.getItem("selectedInstance");
    return saved ? saved : "1";
  });

  useEffect(() => {
    localStorage.setItem("activeSensors", JSON.stringify(activeSensors));
  }, [activeSensors]);

  useEffect(() => {
    localStorage.setItem("selectedInstance", selectedInstance);
  }, [selectedInstance]);

  const addSensor = (instance, sensor) => {
    if (!sensor) return;
    setActiveSensors((prev) => {
      const instanceSensors = prev[instance] || [];
      if (!instanceSensors.includes(sensor)) {
        return { ...prev, [instance]: [...instanceSensors, sensor] };
      }
      return prev;
    });
  };

  const removeSensor = (instance, sensor) => {
    setActiveSensors((prev) => {
      const instanceSensors = prev[instance] || [];
      return { ...prev, [instance]: instanceSensors.filter((s) => s !== sensor) };
    });
  };

  const clearSensors = (instance) => {
    setActiveSensors((prev) => ({ ...prev, [instance]: [] }));
  };

  return (
    <SensorContext.Provider
      value={{
        activeSensors,
        selectedInstance,
        setSelectedInstance,
        addSensor,
        removeSensor,
        clearSensors,
      }}
    >
      {children}
    </SensorContext.Provider>
  );
};
