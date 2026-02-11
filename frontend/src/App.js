// App.js
import React, { Suspense, useContext, useEffect, useState, useCallback } from "react";
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

// Route-level code splitting — only load page components when navigated to
const Home1 = React.lazy(() => import("./components/Home"));
const ProjectsHome = React.lazy(() => import("./components/Projects"));
const CreateProject = React.lazy(() => import("./components/Projects/CreateProject"));
const CreateLiveProject = React.lazy(() => import("./components/Projects/CreateLiveProject"));
const LiveDashboard = React.lazy(() => import("./components/LiveDashboard"));
const ClusterConfig = React.lazy(() => import("./components/ClusterConfig"));
const AdminUsers = React.lazy(() => import("./components/Admin/Users"));
const ChangePassword = React.lazy(() => import("./components/Auth/ChangePassword"));
const UserProfile = React.lazy(() => import("./components/Profile/UserProfile"));
const Jobs = React.lazy(() => import("./components/Jobs"));
const Meta = React.lazy(() => import("./components/Meta"));

const RouteFallback = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 48px)", color: "#94a3b8", fontSize: 13 }}>
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
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
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

  const [isLayoutSwitched, setIsLayoutSwitched] = useState(true);
  const [showJobTree, setShowJobTree] = useState(false);

  const handleLayoutSwitch = useCallback(() => {
    setIsLayoutSwitched((prev) => !prev);
  }, []);

  return (
    <Router>
      <div className="nav">
        {user && (
          <Navbar
            onSwitchLayout={handleLayoutSwitch}
            setShowJobTree={setShowJobTree}
            showJobTree={showJobTree}
          />
        )}
      </div>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated() ? <Navigate to="/projects" /> : <Login />}
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
                  <Home1
                    isLayoutSwitched={isLayoutSwitched}
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
                <Jobs isLayoutSwitched={isLayoutSwitched} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/metadata"
            element={
              user ? (
                <Meta isLayoutSwitched={isLayoutSwitched} />
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
    </Router>
  );
}

export default App;
