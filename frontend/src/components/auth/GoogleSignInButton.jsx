import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// The <GoogleOAuthProvider> in main.jsx is only mounted when VITE_GOOGLE_CLIENT_ID
// is set, so rendering GoogleLogin without the provider throws. Read the env var
// here and bail early if the deployment hasn't opted into Google sign-in.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function GoogleSignInButton({ onError, onBusy }) {
  const nav = useNavigate();
  const { loginWithGoogle } = useAuth();

  if (!GOOGLE_CLIENT_ID) return null;

  const handleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      onError?.("Google did not return a credential. Please try again.");
      return;
    }
    try {
      onBusy?.(true);
      await loginWithGoogle(credential);
      nav("/dashboard");
    } catch (err) {
      onError?.(err.message || "Google sign-in failed.");
    } finally {
      onBusy?.(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-800" />
        <span className="text-xs uppercase tracking-wider text-neutral-500">or</span>
        <div className="h-px flex-1 bg-neutral-800" />
      </div>

      <div className="flex justify-center">
        <GoogleLogin
          theme="filled_black"
          shape="pill"
          size="large"
          text="continue_with"
          onSuccess={handleSuccess}
          onError={() => onError?.("Google sign-in was cancelled or failed.")}
        />
      </div>
    </div>
  );
}
