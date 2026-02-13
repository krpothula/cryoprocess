import React from 'react'
import JobCardList from '../JobCardList'
import "../../App.css"
import JobBuilder from '../JobBuilder'

const Jobs = () => {
  return (
    <div className="App">
    <div className="left-panel">

      <JobCardList />


    </div>
    <div className="right-panel">

       <JobBuilder/>

    </div>
  </div>
  )
}

export default Jobs
