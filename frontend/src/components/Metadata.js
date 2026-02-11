import React from 'react';
import './Metadata.css'; 

function Metadata({ text }) {
  return (
    <div className="metadata">
      <h4>Metadata:</h4>
      <p>{text}</p>
    </div>
  );
}

export default Metadata;
