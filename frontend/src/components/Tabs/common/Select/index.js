import React from 'react';

const Select = ({ options, label, onChange, value }) => {
  return (
    <div className="select-wrapper">
      {label && <label>{label}</label>}
      <select onChange={onChange} value={value}>
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
