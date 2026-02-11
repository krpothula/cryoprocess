import React, { useState } from 'react';
import axios from 'axios';

function Project() {
  // State to manage form inputs
  const [projectName, setProjectName] = useState('');
  const [directoryPath, setDirectoryPath] = useState('');
  const [description, setDescription] = useState('');
  const [responseMessage, setResponseMessage] = useState('');

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Prepare the data to be sent to the backend
    const projectData = {
      name: projectName,
      path: directoryPath,
      description: description,
    };

    try {
      // Send the project data to the backend using Axios
      const response = await axios.post('/api/projects/', projectData);
      
      if (response.status === 201) {
        setResponseMessage('Project created successfully!');
      } else {
        setResponseMessage('An error occurred while creating the project.');
      }
      
      // Clear the form inputs after submission
      setProjectName('');
      setDirectoryPath('');
      setDescription('');
    } catch (error) {
      setResponseMessage('Error: ' + error.message);
    }
  };

  return (
    <div className="project-form">
      <h2>Create New Project</h2>

      <form onSubmit={handleSubmit}>
        {/* Project Name Field */}
        <div>
          <label htmlFor="projectName">Project Name:</label>
          <input
            type="text"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />
        </div>

        {/* Directory Path Field */}
        <div>
          <label htmlFor="directoryPath">Directory Path:</label>
          <input
            type="text"
            id="directoryPath"
            value={directoryPath}
            onChange={(e) => setDirectoryPath(e.target.value)}
            required
          />
        </div>

        {/* Project Description Field */}
        <div>
          <label htmlFor="description">Project Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          ></textarea>
        </div>

        {/* Submit Button */}
        <button type="submit">Create Project</button>
      </form>

      {/* Response Message */}
      {responseMessage && <p>{responseMessage}</p>}
    </div>
  );
}

export default Project;

