import React from "react";
import { twMerge } from "tailwind-merge";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, className }) => {
  return (
    <label className={twMerge("flex items-center gap-3 cursor-pointer select-none", className)}>
      <span className="relative inline-block w-10 h-6">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span
          className="absolute left-0 top-0 w-10 h-6 rounded-full bg-white/20 peer-checked:bg-blue-500 transition-colors duration-200"
        ></span>
        <span
          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-4"
        ></span>
      </span>
      {label && <span className="text-white text-sm">{label}</span>}
    </label>
  );
}; 