import "./styles.css";
import { createApp } from "./ui/app";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

createApp(root);
