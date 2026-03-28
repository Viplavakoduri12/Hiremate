import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiUrl } from "../config/api";
import "./Login.css";

const OTP_LENGTH = 6;
const OTP_EXPIRY_FALLBACK_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_SECONDS = 30;

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};

const UserIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.86 0-7 2.24-7 5v1h14v-1c0-2.76-3.14-5-7-5Z"
    />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm8 6 7.2-4.8A1 1 0 0 0 19 7H5a1 1 0 0 0-.2.2Zm7 5V9l-6.45 4.3a1 1 0 0 1-1.1 0L5 9v8Z"
    />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-6 6.73V17a1 1 0 0 0 2 0v-1.27a2 2 0 1 0-2 0ZM10 9V7a2 2 0 1 1 4 0v2Z"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2 4 5v6c0 5 3.4 9.74 8 11 4.6-1.26 8-6 8-11V5Zm0 11.75L8.75 10.5l1.41-1.41L12 10.92l3.84-3.83 1.41 1.41Z"
    />
  </svg>
);

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const fixedRole = queryParams.get("role") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(fixedRole);

  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(null);
  const [otpDeliveryMode, setOtpDeliveryMode] = useState("email");
  const [directOtp, setDirectOtp] = useState("");
  const [now, setNow] = useState(Date.now());

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (fixedRole) {
      setRole(fixedRole);
    }
  }, [fixedRole]);

  useEffect(() => {
    if (!showOtp) {
      return undefined;
    }

    const syncClock = () => setNow(Date.now());

    syncClock();

    const interval = setInterval(syncClock, 1000);

    return () => clearInterval(interval);
  }, [showOtp]);

  const isValidEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const isBusy = loadingAction !== "";
  const isSendingOtp = loadingAction === "send-otp";
  const isResendingOtp = loadingAction === "resend-otp";
  const isVerifyingOtp = loadingAction === "verify-otp";
  const otpTimeLeft = otpExpiresAt
    ? Math.max(0, Math.ceil((otpExpiresAt - now) / 1000))
    : 0;
  const resendTimeLeft = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
    : 0;
  const isOtpExpired = showOtp && Boolean(otpExpiresAt) && otpTimeLeft === 0;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const validateCredentials = () => {
    if (!email || !password || !role) {
      setMessage("Email, password, and role are required");
      setMessageType("error");
      triggerShake();
      return false;
    }

    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address");
      setMessageType("error");
      triggerShake();
      return false;
    }

    return true;
  };

  const requestOtp = async ({ isResend = false } = {}) => {
    setMessage("");

    if (!validateCredentials()) {
      return false;
    }

    setLoadingAction(isResend ? "resend-otp" : "send-otp");

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed");
        setMessageType("error");
        triggerShake();
        return false;
      }

      const nextExpiry = Number.isFinite(Number(data.expiresAt))
        ? Number(data.expiresAt)
        : Date.now() + OTP_EXPIRY_FALLBACK_MS;
      const nextDeliveryMode = data.deliveryMode === "direct" ? "direct" : "email";
      const nextDirectOtp = nextDeliveryMode === "direct" ? String(data.directOtp || "") : "";

      setShowOtp(true);
      setOtp(nextDirectOtp);
      setOtpExpiresAt(nextExpiry);
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setOtpDeliveryMode(nextDeliveryMode);
      setDirectOtp(nextDirectOtp);
      setNow(Date.now());
      setMessage(
        data.message ||
          (nextDeliveryMode === "direct"
            ? isResend
              ? "A new OTP has been generated on screen"
              : "OTP generated on screen"
            : isResend
              ? "A new OTP has been sent to your email"
              : "OTP sent to your email")
      );
      setMessageType("success");
      return true;
    } catch {
      setMessage("Server error. Please try again.");
      setMessageType("error");
      triggerShake();
      return false;
    } finally {
      setLoadingAction("");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    await requestOtp();
  };

  const handleResendOtp = async () => {
    if (resendTimeLeft > 0 || isBusy) {
      return;
    }

    await requestOtp({ isResend: true });
  };

  const verifyOtp = async () => {
    const numericOtp = otp.replace(/\D/g, "").slice(0, OTP_LENGTH);

    if (numericOtp.length !== OTP_LENGTH) {
      setMessage("Please enter a valid 6-digit OTP");
      setMessageType("error");
      triggerShake();
      return;
    }

    if (isOtpExpired) {
      setMessage("OTP expired. Please resend OTP.");
      setMessageType("error");
      triggerShake();
      return;
    }

    setLoadingAction("verify-otp");

    try {
      const response = await fetch(
        apiUrl("/api/auth/verify-otp"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp: numericOtp }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Invalid OTP");
        setMessageType("error");

        if (data.otpExpired) {
          setOtpExpiresAt(Date.now());
        }

        triggerShake();
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      const expiryTime = Date.now() + 60 * 60 * 1000;
      localStorage.setItem("expiry", String(expiryTime));

      setMessage("Login successful. Redirecting...");
      setMessageType("success");

      setTimeout(() => {
        if (data.role === "applicant") navigate("/applicant");
        if (data.role === "hr") navigate("/hr");
        if (data.role === "admin") navigate("/admin");
      }, 900);
    } catch {
      setMessage("Server error");
      setMessageType("error");
      triggerShake();
    } finally {
      setLoadingAction("");
    }
  };

  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: Math.random() * 6 + 2,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: Math.random() * 10 + 10,
  }));

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="grid-overlay" />

        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}

        <div className={`login-card ${shake ? "shake" : ""}`}>
          <div className="icon-container">
            <div className="icon-wrapper">
              <UserIcon />
            </div>
          </div>

          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to continue to your account</p>

          {message && (
            <div className={`form-message ${messageType}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="input-icon">
                <MailIcon />
              </div>
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="input-icon">
                <LockIcon />
              </div>
            </div>

            <div className="input-group">
              {fixedRole ? (
                <input value={role.toUpperCase()} disabled />
              ) : (
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Select Role</option>
                  <option value="applicant">Applicant</option>
                  <option value="hr">HR</option>
                  <option value="admin">Admin</option>
                </select>
              )}

              <div className="input-icon">
                <UserIcon />
              </div>
            </div>

            {showOtp && (
              <div className="otp-section">
                <div className="divider">
                  <span>Enter OTP</span>
                </div>

                <p className="otp-hint">
                  {otpDeliveryMode === "direct"
                    ? "Use the 6-digit code shown below for this testing session."
                    : "Enter the 6-digit code sent to your email."}
                </p>

                {otpDeliveryMode === "direct" && directOtp && (
                  <div className="otp-preview" aria-live="polite">
                    <span className="otp-preview-label">Direct OTP</span>
                    <strong>{directOtp}</strong>
                  </div>
                )}

                <div className="input-group">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                    }
                    maxLength={OTP_LENGTH}
                  />

                  <div className="input-icon">
                    <ShieldIcon />
                  </div>
                </div>

                <div className="otp-meta">
                  <p className={`otp-timer ${isOtpExpired ? "expired" : ""}`}>
                    {isOtpExpired
                      ? "OTP expired. Resend a new one to continue."
                      : `OTP expires in ${formatCountdown(otpTimeLeft)}`}
                  </p>

                  <button
                    type="button"
                    className="otp-resend"
                    onClick={handleResendOtp}
                    disabled={resendTimeLeft > 0 || isBusy}
                  >
                    {isResendingOtp
                      ? "Sending new OTP..."
                      : resendTimeLeft > 0
                        ? `Resend OTP in ${formatCountdown(resendTimeLeft)}`
                        : "Resend OTP"}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={verifyOtp}
                  disabled={isBusy}
                >
                  {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                </button>
              </div>
            )}

            {!showOtp && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isBusy}
              >
                {isSendingOtp ? "Signing in..." : "Sign In"}
              </button>
            )}
          </form>

          <p className="link">
            New user?{" "}
            <span
              onClick={() =>
                fixedRole
                  ? navigate(`/signup?role=${fixedRole}`)
                  : navigate("/signup")
              }
            >
              Create account
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
