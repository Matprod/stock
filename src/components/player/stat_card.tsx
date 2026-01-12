import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { twMerge } from "tailwind-merge";

interface IStatCardProps {
  title: string;
  value?: number | null;
  link?: string;
}

export const StatCard = ({ title, value, link }: IStatCardProps) => {
  const getValueStyles = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return {
        textColor: "text-slate-500",
        cardClassName: "hover:bg-white/5 bg-transparent border-white/10",
      };
    }
    if (value < 30) {
      return {
        textColor: "text-red-400",
        cardClassName:
          "hover:bg-gradient-to-br hover:from-red-600/20 hover:to-rose-600/20 border-[#FB2C36]",
      };
    }
    if (value < 60) {
      return {
        textColor: "text-yellow-400",
        cardClassName:
          "hover:bg-gradient-to-br hover:from-yellow-500/20 hover:to-amber-600/20 border-[#F0B100]",
      };
    }
    return {
      textColor: "text-emerald-400",
      cardClassName:
        "hover:bg-gradient-to-br hover:from-emerald-500/20 hover:to-green-600/20 border-[#00BC7D]",
    };
  };

  const { textColor, cardClassName } = getValueStyles(value);

  const statCardComponent: ReactNode = (
    <div
      className={twMerge(
        "card flex flex-col text-center w-full border rounded-xl p-4 transition-all duration-300",
        cardClassName,
      )}
    >
      <p className={twMerge("text-2xl font-medium", textColor)}>
        {value === null || value === undefined ? "--" : Math.round(value)}
      </p>
      <p className="text-sm text-white/60 font-normal">{title}</p>
    </div>
  );

  return link ? <Link to={link}>{statCardComponent}</Link> : statCardComponent;
};
