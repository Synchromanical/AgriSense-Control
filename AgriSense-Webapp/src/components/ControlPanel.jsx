import React, { useState } from "react";

const ControlPanel = () => {
  const [templateName, setTemplateName] = useState("Plant55");

  return (
    <div>
      <h2>Control Panel</h2>
      <div>
        <label>Template Name:</label>
        <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        <button>Save</button>
      </div>
    </div>
  );
};

export default ControlPanel;
