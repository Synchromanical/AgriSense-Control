import React, { useState } from "react";

const Logs = () => {
  const [logs] = useState([
    { id: 1, time: "12:00 AM", action: "Temperature Set to 55" },
    { id: 2, time: "12:10 AM", action: "Humidity Set to 55" },
  ]);

  return (
    <div>
      <h2>Recent Logs</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.id}</td>
              <td>{log.time}</td>
              <td>{log.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Logs;
