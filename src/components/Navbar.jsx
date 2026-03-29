import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Navbar.css";

function Navbar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentRole = role || localStorage.getItem("role") || "";

  /* MANUAL LOGOUT */
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  /* AUTO LOGOUT WHEN TOKEN EXPIRES */
  useEffect(() => {
    const checkExpiry = () => {
      const expiry = localStorage.getItem("expiry");

      if (expiry && Date.now() > expiry) {
        localStorage.clear();
        navigate("/login");
      }
    };

    checkExpiry();

    const interval = setInterval(checkExpiry, 60000);
    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className={`navbar ${menuOpen ? "menu-open" : ""}`}>
      <div className="nav-logo">HireMate</div>

      <button
        type="button"
        className={`nav-menu-toggle ${menuOpen ? "open" : ""}`}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`nav-right ${menuOpen ? "open" : ""}`}>

        <div className="nav-links">

          {/* APPLICANT NAVBAR */}
          {currentRole === "applicant" && (
            <>
              <Link to="/track">Dashboard</Link>
              <Link to="/applicant">Apply Job</Link>
            </>
          )}

          {/* HR NAVBAR */}
          {currentRole === "hr" && (
            <>
              <Link to="/hr">HR Dashboard</Link>
              <Link to="/hr">Analyze</Link>
            </>
          )}

          {/* ADMIN NAVBAR */}
          {currentRole === "admin" && (
            <>
              <Link to="/admin">Admin Dashboard</Link>
              <Link to="/admin">Users</Link>
            </>
          )}

        </div>

        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>

      </div>
    </nav>
  );
}

export default Navbar;
