import { useEffect } from "react";
import { useDemoStore } from "../store/demo-store";

export const useDemoMode = () => {
  const { isDemo, setIsDemo } = useDemoStore();

  useEffect(() => {
    let currentInput = "";

    const handleKeyPress = (event: KeyboardEvent) => {
      currentInput += event.key.toLowerCase();

      if (currentInput.length > 10) {
        currentInput = currentInput.slice(-10);
      }

      if (currentInput === "axelbogoss") {
        setIsDemo(true);
        currentInput = "";
      } else if (currentInput === "findemo") {
        setIsDemo(false);
        currentInput = "";
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [setIsDemo]);

  return isDemo;
};
