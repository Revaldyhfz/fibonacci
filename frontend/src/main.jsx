import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App.jsx";

// Vite inlines VITE_* env vars at build time. Empty string = skip the provider
// so the <GoogleLogin> buttons on auth pages stay hidden — the lib throws if
// mounted without a valid client id.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const app = GOOGLE_CLIENT_ID ? (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);

createRoot(document.getElementById("root")).render(
  <StrictMode>{app}</StrictMode>,
);
