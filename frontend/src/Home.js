import React, { useState } from "react";
import JobList from "./components/JobList";
import MonitorList from "./components/MonitorList";
import MainComponent from "./components/MainComponent";

import "./App.css";
import Navbar from "./components/Navbar";
import Home1 from "./components/Home";
import { Route, Router, Routes } from "react-router-dom";
import Jobs from "./components/Jobs";
import Meta from "./components/Meta";


const Home = () => {
  const [selectedJob, setSelectedJob] = useState("Import");
  const [isLayoutSwitched, setIsLayoutSwitched] = useState(true);

  const handleLayoutSwitch = () => {
    setIsLayoutSwitched(!isLayoutSwitched);
  };
  const handleJobSelect = (job) => {
    setSelectedJob(job);
  };


  return (
    <>
    
      <div className="nav">
        <Navbar onSwitchLayout={handleLayoutSwitch} />
      </div>
      <Routes>
        <Route
          path="/"
          element={
            <Home1
              selectedJob={selectedJob}
              handleJobSelect={handleJobSelect}
              isLayoutSwitched={isLayoutSwitched}
            />
          }
        />
        <Route
          path="/jobs"
          element={<Jobs isLayoutSwitched={isLayoutSwitched} />}
          // element={user ? <Jobs /> : <Navigate to="/login" />}
        />
        <Route
          path="/metadata"
          element={<Meta isLayoutSwitched={isLayoutSwitched} />}
          // element={user ? <Meta/> : <Navigate to="/login" />}
        />
      </Routes>
    </>
  );
};

export default Home;
