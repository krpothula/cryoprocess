import React from 'react'
import MonitorList from '../MonitorList'
import "../../App.css"
import MainComponent from '../MainComponent'

const Jobs = ({isLayoutSwitched, }) => {
  return (
    <div className={isLayoutSwitched ? "App" : "App1"}>
    <div className="left-panel">
    
      <MonitorList />
   
     
    </div>
    <div className="right-panel">
   
       <MainComponent/>
    
    </div>
  </div>
  )
}

export default Jobs
