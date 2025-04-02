// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { SensorProvider } from "./SensorContext";
import { DataProvider } from "./DataContext";  // <-- new import

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SensorProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </SensorProvider>
  </React.StrictMode>
);
