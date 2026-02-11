import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { StyleProvider } from "./context/StyleContext";
import { MyProvider } from "./useContext/authContext";
import { ToastContainer } from "react-toastify";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <StyleProvider>
      <MyProvider>
        <App />
        <ToastContainer />
      </MyProvider>
    </StyleProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
