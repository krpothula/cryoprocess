import { useCallback } from "react";
import { toast } from "react-toastify";

const useToast = () => {
  const showToast = useCallback((message, options = {}) => {
    // Default settings
    const defaultOptions = {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      closeButton: false,
      className: "text-black dark:text-slate-100",
    };

    // Merge default options with user-provided options
    const toastOptions = { ...defaultOptions, ...options };

    // Show the toast message
    toast(message, toastOptions);
  }, []);

  return showToast;
};

export default useToast;
