import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Starfield from "./Starfield";
import "../styles/Home3D.css";

export default function Home3D() {
  const [wordIndex, setWordIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState({});
  const navigate = useNavigate();

  const words = ["Simplified", "Faster", "Smarter", "Fairer"];

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const toggleFlip = (cardId) => {
    setFlippedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  return (
    <div className="home-wrapper-3d">
      <Starfield />

      {/* NAVBAR */}
      <nav className="home-nav">
        <div className="home-logo">HireMate</div>

        <div className="home-auth">
          <Link to="/signup" className="nav-signup">
            Create Account
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero-section-3d">
        <div className="hero-content-wrapper">
          <h1 className="hero-title">
            Hiring,&nbsp;
            <span className="changing-word">{words[wordIndex]}</span>
          </h1>

          <p className="hero-subtitle">
            HireMate is a smart Applicant Tracking System that helps companies
            screen resumes and hire faster.
          </p>

          <div className="hero-actions">
            <button
              className="btn-outline btn-primary"
              onClick={() => navigate("/login?role=applicant")}
            >
              I'm a Job Seeker
            </button>

            <button
              className="btn-outline btn-secondary"
              onClick={() => navigate("/login?role=hr")}
            >
              I'm an HR Recruiter
            </button>
          </div>

          <div className="hero-secondary-action">
            <Link to="/login" className="hero-login-link">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* WORKFLOW SECTION */}
      <section className="workflow-section">
        <h2>How It Works</h2>

        <div className="workflow-cards">
          {[
            {
              id: 1,
              icon: "01",
              title: "Create Profile",
              desc: "Set up your professional profile in minutes",
              details: [
                "Complete profile info",
                "Upload resume",
                "Showcase skills",
                "Add portfolio links",
              ],
            },
            {
              id: 2,
              icon: "02",
              title: "Discover Matches",
              desc: "Find opportunities tailored to you",
              details: [
                "AI-powered matching",
                "Custom filters",
                "Job alerts",
                "Saved positions",
              ],
            },
            {
              id: 3,
              icon: "03",
              title: "Land Your Role",
              desc: "Connect and secure your next opportunity",
              details: [
                "Easy applications",
                "Direct messaging",
                "Interview prep",
                "Offer management",
              ],
            },
          ].map((card) => (
            <div key={card.id} className="workflow-card">
              <div className="card-3d">
                <div
                  className={`card-inner ${
                    flippedCards[`workflow-${card.id}`] ? "flipped" : ""
                  }`}
                >
                  <div className="card-front">
                    <div className="card-icon">{card.icon}</div>
                    <h3>{card.title}</h3>
                    <p>{card.desc}</p>
                  </div>

                  <div className="card-back">
                    <ul>
                      {card.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <button
                className="flip-btn"
                onClick={() => toggleFlip(`workflow-${card.id}`)}
              >
                {flippedCards[`workflow-${card.id}`] ? "Back" : "Details"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ROLES SECTION */}
      <section className="roles-section">
        <h2>For Everyone</h2>

        <div className="roles-cards">
          {[
            {
              id: 1,
              emoji: "💼",
              title: "Job Seekers",
              subtitle: "Find your dream job",
              details: [
                "Browse thousands of opportunities",
                "Get personalized recommendations",
                "Apply with one click",
              ],
            },
            {
              id: 2,
              emoji: "👥",
              title: "HR Teams",
              subtitle: "Build your dream team",
              details: [
                "Post and manage jobs",
                "Screen candidates easily",
                "Collaborate with team",
              ],
            },
          ].map((role) => (
            <div key={role.id} className="role-card">
              <div className="card-3d">
                <div
                  className={`card-inner ${
                    flippedCards[`role-${role.id}`] ? "flipped" : ""
                  }`}
                >
                  <div className="card-front">
                    <div className="card-emoji">{role.emoji}</div>
                    <h3>{role.title}</h3>
                    <p>{role.subtitle}</p>
                  </div>

                  <div className="card-back">
                    <ul>
                      {role.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <button
                className="flip-btn"
                onClick={() => toggleFlip(`role-${role.id}`)}
              >
                {flippedCards[`role-${role.id}`] ? "Back" : "Learn More"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="home-footer">
        <p>© 2025 HireMate. Connecting talent with opportunity.</p>
      </footer>
    </div>
  );
}
