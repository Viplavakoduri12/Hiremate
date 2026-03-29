import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl } from "../config/api";
import "./TrackStatus.css";

const steps = [
  { key: "APPLIED", label: "Applied" },
  { key: "UNDER_REVIEW", label: "Review" },
  { key: "SHORTLISTED", label: "Shortlisted" },
  { key: "ACCEPTED", label: "Selected" }
];

function TrackStatus() {

  const [applications, setApplications] = useState([]);
  const [flippedCards, setFlippedCards] = useState({});

  /* FETCH USER APPLICATIONS */

  useEffect(() => {

    fetch(apiUrl("/api/applications/my-applications"), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(data => {

        const formatted = data.map(app => ({
          jobRole: app.role,
          status: app.status,
          createdAt: app.createdAt,
          rejectionReason: app.rejectionReason || ""
        }));

        setApplications(formatted);

      })
      .catch(err =>
        console.error("Dashboard fetch error:", err)
      );

  }, []);

  /* PROGRESS PERCENT */

  const getProgressPercent = (status) => {

    if (status === "REJECTED") return 25;

    const index = steps.findIndex(
      (s) => s.key === status
    );

    if (index === -1) return 0;

    return Math.round(
      ((index + 1) / steps.length) * 100
    );
  };

  const toggleCard = (index) => {
    setFlippedCards((current) => ({
      ...current,
      [index]: !current[index],
    }));
  };

  /* ESTIMATED TIME */

  const getEstimatedTime = (status) => {

    switch (status) {

      case "APPLIED":
        return "5-7 working days";

      case "UNDER_REVIEW":
        return "3-5 working days";

      case "SHORTLISTED":
        return "1-2 working days";

      case "ACCEPTED":
        return "Decision completed";

      case "REJECTED":
        return "Application not selected";

      default:
        return "Pending";

    }
  };

  /* SUMMARY */

  const summary = {

    total: applications.length,

    review: applications.filter(
      a => a.status === "UNDER_REVIEW"
    ).length,

    shortlisted: applications.filter(
      a => a.status === "SHORTLISTED"
    ).length,

    accepted: applications.filter(
      a => a.status === "ACCEPTED"
    ).length

  };

  return (
    <>
      <Navbar />

      <div className="track-wrapper">

        {/* SUMMARY BAR */}

        <div className="summary-bar">

          <div className="summary-card">
            Total: {summary.total}
          </div>

          <div className="summary-card">
            Review: {summary.review}
          </div>

          <div className="summary-card">
            Shortlisted: {summary.shortlisted}
          </div>

          <div className="summary-card">
            Accepted: {summary.accepted}
          </div>

        </div>

        {/* APPLICATION CARDS */}

        <div className="cards-grid">

          {applications.map((app, index) => {

            const currentStep = steps.findIndex(
              step => step.key === app.status
            );

            const progress = getProgressPercent(
              app.status
            );

            return (

              <div
                className={`flip-card ${flippedCards[index] ? "flipped" : ""}`}
                key={index}
                role="button"
                tabIndex={0}
                onClick={() => toggleCard(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleCard(index);
                  }
                }}
              >

                <div className="flip-inner">

                  {/* FRONT */}

                  <div className="flip-front">

                    <h2 className="status-title">
                      {app.status.replace(/_/g, " ")}
                    </h2>

                    <h4 className="job-role">
                      {app.jobRole}
                    </h4>

                    <div className="timeline">

                      {steps.map((step, i) => {

                        const completed =
                          i <= currentStep;

                        return (

                          <div
                            className="timeline-step-wrapper"
                            key={step.key}
                          >

                            <div className="timeline-step">

                              <div
                                className={`dot ${
                                  completed ? "active" : ""
                                }`}
                              />

                              {i < steps.length - 1 && (

                                <div
                                  className={`line ${
                                    i < currentStep
                                      ? "active"
                                      : ""
                                  }`}
                                />

                              )}

                            </div>

                            <span
                              className={`step-label ${
                                completed
                                  ? "active-label"
                                  : ""
                              }`}
                            >
                              {step.label}
                            </span>

                          </div>

                        );

                      })}

                    </div>

                    {/* PROGRESS */}

                    <div className="progress-section">

                      <div className="progress-label">
                        Progress: {progress}%
                      </div>

                      <div className="progress-bar">

                        <div
                          className="progress-fill"
                          style={{
                            width: `${progress}%`
                          }}
                        />

                      </div>

                    </div>

                    <p className="flip-hint">Tap card to view details</p>

                  </div>

                  {/* BACK */}

                  <div className="flip-back">

                    <h3>Application Details</h3>

                    <p>
                      <strong>Role:</strong>{" "}
                      {app.jobRole}
                    </p>

                    <p>
                      <strong>Status:</strong>{" "}
                      {app.status}
                    </p>

                    <p>
                      <strong>Applied On:</strong>{" "}
                      {new Date(
                        app.createdAt
                      ).toLocaleDateString()}
                    </p>

                    <p>
                      ⏳ {getEstimatedTime(app.status)}
                    </p>

                    {/* REJECTION REASON */}

                    {app.status === "REJECTED" &&
                      app.rejectionReason && (

                        <p className="reject-reason">

                          <strong>Reason:</strong>{" "}
                          {app.rejectionReason}

                        </p>

                      )}

                    <p className="flip-hint">Tap card to go back</p>

                  </div>

                </div>

              </div>

            );

          })}

        </div>

      </div>
    </>
  );
}

export default TrackStatus;
