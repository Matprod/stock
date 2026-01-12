import { twMerge } from "tailwind-merge";

interface CircularProgressProps {
  progress?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  withZero?: boolean;
  textSize?: string;
}

export default function CircularProgress({
  progress,
  size = 100,
  strokeWidth = 8,
  color = "stroke-orange-500",
  withZero = false,
  textSize = "text-2xl",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (!!progress ? (progress / 100) * circumference : 0);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none stroke-[#3a4454]"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={twMerge("fill-none", color)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className={twMerge("absolute text-gray-100 font-semibold", textSize)}>
        {progress !== undefined ? `${Math.round(progress)}%` : withZero ? "0%" : "-"}
      </div>
    </div>
  );
}
