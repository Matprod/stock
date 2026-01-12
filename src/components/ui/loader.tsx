interface LoaderProps {
  size?: "sm" | "lg";
}

export const Loader = ({ size = "lg" }: LoaderProps) => {
  const dimensions = size === "sm" ? "w-8 h-8" : "w-32 h-32";

  return (
    <div className={`flex items-center justify-center ${size === "lg" ? "h-screen" : ""}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="72"
        height="57"
        viewBox="0 0 72 57"
        fill="none"
        className={`mauna-loader-svg ${dimensions}`}
      >
        <style>
          {`
            .mauna-loader-svg path, .mauna-loader-svg line, .mauna-loader-svg polyline, .mauna-loader-svg polygon {
              stroke-dasharray: 500;
              stroke-dashoffset: 500;
              animation: draw 2s linear infinite;
            }
            @keyframes draw {
              to {
                stroke-dashoffset: 0;
              }
            }
          `}
        </style>
        <path
          d="M3 53.8961L13.3345 25.4457C13.6503 24.5763 14.6023 24.1179 15.4789 24.4133L28.1914 28.6966C28.9803 28.9624 29.8457 28.619 30.2376 27.8845L42.9028 4.14943C43.5675 2.90389 45.3719 2.96146 45.9558 4.24682L68.5096 53.8961M18.3755 52.2306H50.1582"
          stroke="white"
          strokeWidth="3.10894"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
