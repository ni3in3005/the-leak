import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthGate } from "./components/AuthGate";
import "./styles.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function MissingClerkConfig() {
  return (
    <div className="auth-gate">
      <div className="auth-panel">
        <div className="eyebrow">Setup required</div>
        <h1>The Leak</h1>
        <div className="sub">
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>apps/web/.env.local</code> (see{" "}
          <code>.env.example</code>), then restart the Vite dev server.
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {publishableKey && !publishableKey.includes("REPLACE") ? (
      <ClerkProvider publishableKey={publishableKey}>
        <AuthGate />
      </ClerkProvider>
    ) : (
      <MissingClerkConfig />
    )}
  </StrictMode>
);
