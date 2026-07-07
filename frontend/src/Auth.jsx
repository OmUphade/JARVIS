import React, { useState, useEffect } from "react";
import "./Auth.css";
import logo from "./assets/jarvis6.png";

function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  let API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080/api/v1";
  if (API_URL && !API_URL.includes("/api/v1")) {
    API_URL = `${API_URL.replace(/\/$/, "")}/api/v1`;
  }

  // If upgrading from a guest session, default to registration form
  useEffect(() => {
    const isUpgrading = localStorage.getItem("upgradeGuestId");
    if (isUpgrading) {
      setIsLogin(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isLogin
      ? `${API_URL}/auth/login`
      : `${API_URL}/auth/register`;

    const guestUserId = localStorage.getItem("upgradeGuestId") || localStorage.getItem("guestUserId");

    const payload = isLogin
      ? { email, password, guestUserId }
      : { name, email, password, guestUserId };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const res = await response.json();

      if (!response.ok) {
        throw new Error(res.error?.message || "Something went wrong.");
      }

      // Cleanup guest session storage flags on successful registered account login
      localStorage.removeItem("upgradeGuestId");
      localStorage.removeItem("isGuest");
      localStorage.removeItem("guestUserId");

      if (res.success && res.data.accessToken) {
        localStorage.setItem("accessToken", res.data.accessToken);
        onAuthSuccess(res.data.accessToken);
      }
    } catch (err) {
      if (err.message === "Failed to fetch" || err.message.toLowerCase().includes("fetch")) {
        setError("⚠️ The server is waking up (Render servers sleep after 15m of inactivity). Please wait 30-45 seconds and click Submit again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/guest`, {
        method: "POST",
      });
      const res = await response.json();
      if (!response.ok) {
        throw new Error(res.error?.message || "Guest session failed.");
      }

      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("isGuest", "true");
      localStorage.setItem("guestUserId", res.data.user.id);
      
      onAuthSuccess(res.data.accessToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authContainer">
      <div className="authCard">
        <div className="authLogo">
          <img src={logo} alt="Jarvis logo" />
        </div>
        <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>
        <p className="authSubtitle">
          {isLogin ? "Log in to access JARVIS" : "Sign up to begin your journey"}
        </p>

        {error && (
          <div className={`authAlert ${error.includes("created") || error.includes("log in") ? "success" : "error"}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="formGroup">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="formGroup">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="formGroup">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="authButton" disabled={loading}>
            {loading ? "Processing..." : isLogin ? "Log In" : "Sign Up"}
          </button>

          {isLogin && (
            <button
              type="button"
              className="guestButton"
              onClick={handleGuestLogin}
              disabled={loading}
            >
              {loading ? "Processing..." : "Continue as Guest"}
            </button>
          )}
        </form>

        <div className="authToggle">
          {isLogin ? "New to JARVIS? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(""); }}>
            {isLogin ? "Sign Up" : "Log In"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Auth;
