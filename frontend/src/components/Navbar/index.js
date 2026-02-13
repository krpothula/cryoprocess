import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MyContext } from "../../useContext/authContext";
import { logout } from "../../utils/session";
import { FiUser, FiLogOut, FiFolder, FiGitBranch, FiServer, FiChevronRight, FiUsers, FiMoon, FiSun } from "react-icons/fi";
import { getProjectByIdApi } from "../../services/projects/projects";
import { getSession } from "../../services/liveSession";
import { useTheme } from "../../context/ThemeContext";

const Navbar = ({ setShowJobTree, showJobTree }) => {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const modalRef = useRef(null);
  const navigate = useNavigate();
  const { setUser } = useContext(MyContext);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  // Check if user is admin (staff or superuser)
  let userInfo = {};
  try { userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}"); } catch (_) { /* corrupted storage */ }
  const isAdmin = userInfo.is_superuser || userInfo.is_staff;

  // Get user initials
  const getInitials = () => {
    const first = userInfo.first_name?.charAt(0)?.toUpperCase() || '';
    const last = userInfo.last_name?.charAt(0)?.toUpperCase() || '';
    if (first && last) return `${first}${last}`;
    if (first) return first;
    if (userInfo.username) return userInfo.username.charAt(0).toUpperCase();
    return 'U';
  };

  let projectId = null;
  let sessionId = null;

  const pathParts = location.pathname.split("/");
  if (pathParts[1] === "project" && pathParts.length > 2) {
    projectId = pathParts[2];
  } else if (pathParts[1] === "live" && pathParts.length > 1) {
    sessionId = pathParts[2];
  }

  // Fetch project name for regular project pages
  useEffect(() => {
    if (projectId) {
      getProjectByIdApi(projectId)
        .then((resp) => {
          const responseData = resp?.data;
          const project = responseData?.data || responseData;
          if (Array.isArray(project) && project[0]?.project_name) {
            setProjectName(project[0].project_name);
          } else if (project?.project_name) {
            setProjectName(project.project_name);
          }
        })
        .catch(() => {
          setProjectName("");
        });
    } else if (sessionId) {
      // For live sessions: fetch session -> get project_id -> fetch project name
      getSession(sessionId)
        .then((resp) => {
          const sessionData = resp?.data?.data || resp?.data;
          const pid = sessionData?.project_id;
          if (pid) {
            return getProjectByIdApi(pid);
          }
          throw new Error("No project_id");
        })
        .then((resp) => {
          const responseData = resp?.data;
          const project = responseData?.data || responseData;
          if (Array.isArray(project) && project[0]?.project_name) {
            setProjectName(project[0].project_name);
          } else if (project?.project_name) {
            setProjectName(project.project_name);
          }
        })
        .catch(() => {
          setProjectName("");
        });
    } else {
      setProjectName("");
    }
  }, [projectId, sessionId]);

  const toggleModal = () => {
    setOpen(!open);
  };
  const handleLogout = () => {
    setUser(false);
    logout();
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  });

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className="navbar-container">
        <div className="navbar-content">
          {/* Logo/Brand */}
          <div className="navbar-brand" onClick={() => navigate("/projects")} role="button" tabIndex="0" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate("/projects"); }} aria-label="Go to projects">
            <span className="brand-text">CryoProcess</span>
          </div>

          {/* Project Name Breadcrumb */}
          {(projectId || sessionId) && projectName && (
            <div className="navbar-project">
              <FiChevronRight className="project-separator" />
              <span className="project-name">{projectName}</span>
            </div>
          )}

          {/* Navigation Links */}
          <div className="navbar-links">
            {/* Cluster - Always visible */}
            <Link
              to="/cluster-config"
              className={`nav-link ${isActive("/cluster-config") ? "active" : ""}`}
            >
              <FiServer className="nav-icon" />
              <span>Cluster</span>
            </Link>

            {/* Projects - Always visible */}
            <Link
              to="/projects"
              className={`nav-link ${isActive("/projects") ? "active" : ""}`}
            >
              <FiFolder className="nav-icon" />
              <span>Projects</span>
            </Link>

            {/* Admin Users - Only visible for admin users */}
            {isAdmin && (
              <Link
                to="/admin/users"
                className={`nav-link ${isActive("/admin/users") ? "active" : ""}`}
              >
                <FiUsers className="nav-icon" />
                <span>Users</span>
              </Link>
            )}

            {/* Job Tree - Only visible inside a project */}
            {projectId && (
              <button
                onClick={() => setShowJobTree(!showJobTree)}
                className={`nav-link ${showJobTree ? "active" : ""}`}
                aria-expanded={showJobTree}
                aria-label="Toggle job tree"
              >
                <FiGitBranch className="nav-icon" />
                <span>Job Tree</span>
              </button>
            )}
          </div>

          {/* Profile Menu */}
          <div className="navbar-profile" ref={modalRef}>
            <button className="profile-btn" onClick={toggleModal} aria-label="Open profile menu" aria-expanded={open} aria-haspopup="menu">
              <span className="profile-initials">{getInitials()}</span>
            </button>

            {open && (
              <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">{getInitials()}</div>
                  <div className="dropdown-user-info">
                    <span className="dropdown-username">{userInfo.username || 'Account'}</span>
                    <span className={`dropdown-role ${userInfo.is_superuser ? 'superuser' : userInfo.is_staff ? 'staff' : 'user'}`}>
                      {userInfo.is_superuser ? 'Superuser' : userInfo.is_staff ? 'Staff' : 'User'}
                    </span>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-item" role="menuitem" onClick={() => { setOpen(false); navigate("/profile"); }}>
                  <FiUser size={18} aria-hidden="true" />
                  <span>Profile</span>
                </button>
                <button className="dropdown-item" role="menuitem" onClick={() => { toggleTheme(); }}>
                  {isDark ? <FiSun size={18} aria-hidden="true" /> : <FiMoon size={18} aria-hidden="true" />}
                  <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </button>
                <div className="dropdown-divider" role="separator" />
                <button className="dropdown-item logout" role="menuitem" onClick={handleLogout}>
                  <FiLogOut size={18} aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <style>{`
        .navbar-container {
          position: sticky;
          top: 0;
          z-index: 50;
          width: 100%;
          height: 48px;
          background: var(--color-bg-card);
          border-bottom: 1px solid var(--color-border);
        }

        .navbar-content {
          display: flex;
          align-items: center;
          height: 100%;
          padding: 0 16px;
          max-width: 100%;
        }

        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 4px 0;
        }

        .brand-logo {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          object-fit: contain;
        }

        .brand-text {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .navbar-brand:hover .brand-text {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .navbar-project {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 6px;
        }

        .project-separator {
          color: var(--color-text-muted);
          font-size: 14px;
        }

        .project-name {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-heading);
        }

        .project-live-badge {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--color-primary-bg);
          color: var(--color-primary);
          letter-spacing: 0.5px;
        }

        .navbar-links {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          margin-right: 12px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          color: var(--color-text-secondary);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .nav-link:hover {
          color: var(--color-text-heading);
        }

        .nav-link.active {
          color: var(--color-primary);
          font-weight: 600;
        }

        .nav-icon {
          font-size: 15px;
        }

        .navbar-profile {
          position: relative;
        }

        .profile-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .profile-btn:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: scale(1.05);
        }

        .profile-initials {
          color: white;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .profile-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 200px;
          background: var(--color-bg-card);
          border-radius: 12px;
          border: 1px solid var(--color-border);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          animation: dropdownFade 0.15s ease;
        }

        @keyframes dropdownFade {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dropdown-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: var(--color-bg-hover);
          border-bottom: 1px solid var(--color-border);
        }

        .dropdown-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 50%;
          color: white;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        .dropdown-header span {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-heading);
        }

        .dropdown-divider {
          height: 1px;
          background: var(--color-border);
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          font-size: 13px;
          color: var(--color-text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .dropdown-item:hover {
          background: var(--color-bg-hover);
        }

        .dropdown-item.logout {
          color: var(--color-danger-text);
        }

        .dropdown-item.logout:hover {
          background: var(--color-danger-bg);
        }

        .dropdown-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dropdown-username {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-heading);
        }

        .dropdown-role {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .dropdown-role.superuser {
          background: var(--color-warning-bg);
          color: var(--color-warning-text);
        }

        .dropdown-role.staff {
          background: var(--color-info-bg);
          color: var(--color-info-text);
        }

        .dropdown-role.user {
          background: var(--color-bg-hover);
          color: var(--color-text-muted);
        }
      `}</style>
    </>
  );
};

export default Navbar;
