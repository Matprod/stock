import { useDevMode } from "../../hooks/useDevMode";

export const DevIndicator = () => {
  const isDev = useDevMode();

  if (!isDev) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg border-2 border-red-600 animate-pulse">
      DEV MODE
    </div>
  );
};
