import React, { createContext, useContext, useState } from 'react';

const StyleContext = createContext();

export const StyleProvider = ({ children }) => {
    const [inputStyle, setInputStyle] = useState({
        height: '36px',
        width: '100%',
        border: '1px solid gray',
        padding: '8px',
        borderRadius: '4px',
        backgroundColor: "#ffffe3",
    });

    const changeInputStyle = (newStyles) => {
        setInputStyle(prev => ({ ...prev, ...newStyles }));
    };
 
    return (
        <StyleContext.Provider value={{ inputStyle, changeInputStyle }}>
            {children}
        </StyleContext.Provider>
    );
};

export const useStyle = () => useContext(StyleContext);
