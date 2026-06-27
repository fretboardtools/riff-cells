import React from "react";
import { createRoot } from "react-dom/client";
import RiffCells from "./RiffCells.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RiffCells />
  </React.StrictMode>
);
