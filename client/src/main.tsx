import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import StrategiesPage from './pages/strategies';
import OptimizePage from './pages/optimize';
import PaperTradingPage from './pages/paper-trading';

createRoot(document.getElementById("root")!).render(<App />);