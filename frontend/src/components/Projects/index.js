import React, { useState } from "react";
import ProjectsList from "./List";
import { FiPlus, FiSearch, FiZap, FiArchive } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const ProjectsHome = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="projects-page">
      <div className="projects-container">
        {/* Header Section */}
        <header className="projects-header">
          <div className="header-title">
            <h1>Projects</h1>
            <span className="header-subtitle">Manage your CryoEM projects</span>
          </div>
          <div className="header-actions">
            <div className="search-wrapper">
              <FiSearch />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              className={`btn-archive-toggle ${showArchived ? "active" : ""}`}
              onClick={() => setShowArchived(!showArchived)}
              title={showArchived ? "Hide archived projects" : "Show archived projects"}
            >
              <FiArchive />
              <span>Archived</span>
            </button>
            <button
              className="btn-live-project"
              onClick={() => navigate("/projects/create-live")}
            >
              <FiZap />
              <span>New Live Project</span>
            </button>
            <button
              className="btn-new-project"
              onClick={() => navigate("/projects/create")}
            >
              <FiPlus />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="projects-main">
          <ProjectsList searchTerm={searchTerm} showArchived={showArchived} />
        </main>
      </div>

      <style>{`
        .projects-page {
          min-height: calc(100vh - 48px);
          background: linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%);
        }

        .projects-container {
          width: 100%;
          padding: 24px 32px;
        }

        .projects-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .header-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .header-title h1 {
          font-size: 24px;
          font-weight: 600;
          color: var(--color-text-heading);
          margin: 0;
        }

        .header-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .search-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px;
          height: 42px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          width: 280px;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .search-wrapper:focus-within {
          border-color: var(--color-primary);
        }

        .search-wrapper svg {
          color: var(--color-text-muted);
          font-size: 16px;
          flex-shrink: 0;
        }

        .search-wrapper input {
          flex: 1;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          font-size: 14px;
          color: var(--color-text-heading);
          background: transparent;
          appearance: none;
        }

        .search-wrapper input::placeholder {
          color: var(--color-text-muted);
        }

        .btn-archive-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 16px;
          background: var(--color-bg-card);
          color: var(--color-text-secondary);
          font-size: 14px;
          font-weight: 500;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-archive-toggle:hover {
          background: var(--color-bg-hover);
          border-color: var(--color-border-hover);
        }

        .btn-archive-toggle.active {
          background: var(--color-warning-bg);
          color: var(--color-warning-text);
          border-color: var(--color-warning-text);
        }

        .btn-archive-toggle svg {
          font-size: 16px;
        }

        .btn-live-project {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 20px;
          background: var(--color-primary);
          color: white;
          font-size: 14px;
          font-weight: 500;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-live-project:hover {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .btn-live-project svg {
          font-size: 16px;
        }

        .btn-new-project {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 20px;
          background: var(--color-primary);
          color: white;
          font-size: 14px;
          font-weight: 500;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-new-project:hover {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .btn-new-project svg {
          font-size: 16px;
        }

        .projects-main {
          background: var(--color-bg-card);
          border-radius: 16px;
          border: 1px solid var(--color-border);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
          overflow: visible;
        }

        @media (max-width: 900px) {
          .projects-container {
            padding: 24px;
          }

          .projects-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
          }

          .header-actions {
            width: 100%;
            flex-direction: column;
          }

          .search-wrapper {
            width: 100%;
          }

          .btn-live-project,
          .btn-new-project {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default ProjectsHome;
