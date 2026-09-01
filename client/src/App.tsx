import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DisplayPage } from "./pages/DisplayPage";
import { ControllerPage } from "./pages/ControllerPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DisplayPage />} />
        <Route path="/controller/:roomId" element={<ControllerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
