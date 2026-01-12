import { useEffect } from "react";
import { useDevStore } from "../store/dev-store";

export const useDevMode = () => {
  const { isDev, setIsDev } = useDevStore();

  useEffect(() => {
    let currentInput = "";

    const handleKeyPress = (event: KeyboardEvent) => {
      currentInput += event.key.toLowerCase();

      if (currentInput.length > 10) {
        currentInput = currentInput.slice(-10);
      }

      if (currentInput === "godev") {
        setIsDev(true);
        currentInput = "";
      } else if (currentInput === "devoff") {
        setIsDev(false);
        currentInput = "";
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [setIsDev]);

  return isDev;
};
