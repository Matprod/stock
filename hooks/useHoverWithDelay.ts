import { useState } from "react";

export const useHoverWithDelay = (onOpen: () => void, onClose: () => void, delay = 350) => {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutId) clearTimeout(timeoutId);
    onOpen();
  };

  const handleMouseLeave = () => {
    const id = setTimeout(() => {
      onClose();
    }, delay);
    setTimeoutId(id);
  };

  return { handleMouseEnter, handleMouseLeave };
}
