// App.js
import React, { Component, Suspense, useContext, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import Login from "./Login";
import { MyContext } from "./useContext/authContext";
import Navbar from "./components/Navbar";
import { isAuthenticated } from "./utils/auth";

// Error boundary catches render errors in lazy-loaded route components
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 48px)", color: "var(--color-text-muted)", fontSize: 13, gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--color-danger-text)" }}>Something went wrong</span>
          <span>{this.state.error?.message || "An unexpected error occurred"}</span>
          <button onClick={() => window.location.reload()} style={{ padding: "6px 16px", borderRadius: 4, background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12 }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Route-level code splitting — only load page components when navigated to
const ProjectWorkspace = React.lazy(() => import("./components/ProjectWorkspace"));
const ProjectsHome = React.lazy(() => import("./components/Projects"));
const CreateProject = React.lazy(() => import("./components/Projects/CreateProject"));
const CreateLiveProject = React.lazy(() => import("./components/Projects/CreateLiveProject"));
const LiveDashboard = React.lazy(() => import("./components/LiveDashboard"));
const ClusterConfig = React.lazy(() => import("./components/ClusterConfig"));
const AdminUsers = React.lazy(() => import("./components/Admin/Users"));
const AdminUsage = React.lazy(() => import("./components/Admin/Usage"));
const AdminAuditLog = React.lazy(() => import("./components/Admin/AuditLog"));
const ChangePassword = React.lazy(() => import("./components/Auth/ChangePassword"));
const ForgotPassword = React.lazy(() => import("./components/Auth/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./components/Auth/ResetPassword"));
const UserProfile = React.lazy(() => import("./components/Profile/UserProfile"));
const Jobs = React.lazy(() => import("./components/Jobs"));
const JobMonitor = React.lazy(() => import("./components/JobMonitor"));

const RouteFallback = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 48px)", color: "var(--color-text-muted)", fontSize: 13 }}>
    Loading...
  </div>
);

// Route guards defined outside App to keep stable component references
// (prevents child remounting when App state like showJobTree changes)
const PrivateRoute = ({ element }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return element;
};

const AdminRoute = ({ element }) => {
  let userInfo = {};
  try { userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}"); } catch (_) { /* corrupted storage */ }
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  if (!userInfo.is_superuser && !userInfo.is_staff) {
    return <Navigate to="/projects" />;
  }
  return element;
};

function App() {
  const { user, setUser } = useContext(MyContext);

  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated") === "true";
    if (isAuth) {
      setUser(true);
    }
  }, [setUser]);

  const [showJobTree, setShowJobTree] = useState(false);

  return (
    <Router>
      <div className="nav">
        {user && (
          <Navbar
            setShowJobTree={setShowJobTree}
            showJobTree={showJobTree}
          />
        )}
      </div>
      <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated() ? <Navigate to="/projects" /> : <Login />}
          />
          <Route
            path="/forgot-password"
            element={isAuthenticated() ? <Navigate to="/projects" /> : <ForgotPassword />}
          />
          <Route
            path="/reset-password"
            element={isAuthenticated() ? <Navigate to="/projects" /> : <ResetPassword />}
          />
          <Route
            path="/projects"
            element={<PrivateRoute element={<ProjectsHome />} />}
          />
          <Route
            exact
            path="/projects/create"
            element={<PrivateRoute element={<CreateProject />} />}
          />
          <Route
            exact
            path="/projects/create-live"
            element={<PrivateRoute element={<CreateLiveProject />} />}
          />
          <Route
            path="/live/:sessionId"
            element={<PrivateRoute element={<LiveDashboard />} />}
          />
          <Route
            path="/project/:id"
            element={
              <PrivateRoute
                element={
                  <ProjectWorkspace
                    showJobTree={showJobTree}
                    setShowJobTree={setShowJobTree}
                  />
                }
              />
            }
          />

          <Route
            path="*"
            element={<Navigate to={isAuthenticated() ? "/projects" : "/login"} />}
          />
          <Route
            path="/jobs"
            element={
              user ? (
                <Jobs />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/metadata"
            element={
              user ? (
                <JobMonitor />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/cluster-config"
            element={<PrivateRoute element={<ClusterConfig />} />}
          />
          <Route
            path="/admin/users"
            element={<AdminRoute element={<AdminUsers />} />}
          />
          <Route
            path="/admin/usage"
            element={<AdminRoute element={<AdminUsage />} />}
          />
          <Route
            path="/admin/audit"
            element={<AdminRoute element={<AdminAuditLog />} />}
          />
          <Route
            path="/profile"
            element={<PrivateRoute element={<UserProfile />} />}
          />
          <Route
            path="/change-password"
            element={
              <PrivateRoute
                element={<ChangePassword />}
              />
            }
          />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
