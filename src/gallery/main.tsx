import { createRoot } from "react-dom/client";
import "../ui/tokens.css";
import "./gallery.css";
import { Gallery } from "./Gallery";
createRoot(document.getElementById("root")!).render(<Gallery />);
