import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CapturaInventario from "./pages/CapturaInventario";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CapturaInventario />} />
      </Routes>
    </Router>
  );
}

export default App;
