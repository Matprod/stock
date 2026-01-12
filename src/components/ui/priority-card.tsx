import { Target } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { cva } from "class-variance-authority";

export interface PriorityCardProps {
  count: number;
  selected: boolean;
  href: string;
}

const containerVariants = cva(
  "relative border border-white/10 rounded-xl p-4 pt-3 transition-all duration-300 overflow-hidden w-[136px] hover:bg-white/10",
  {
    variants: {
      selected: {
        true: "bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-400/40",
        false: "bg-[#252D3B]",
      },
    },
  },
);

export const PriorityCard = ({ count, selected, href }: PriorityCardProps) => {
  const { t } = useTranslation("summary");
  const isDisabled = count === 0;
  const displayCount = Math.min(count, 6);

  return (
    <Link
      to={href}
      className={cn(isDisabled && "pointer-events-none opacity-50")}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
        }
      }}
    >
      <div
        className={cn(
          containerVariants({
            selected: selected && !isDisabled,
          }),
        )}
      >
        <div className="">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "size-7 rounded-lg flex items-center justify-center",
                isDisabled ? "bg-slate-700" : "bg-purple-500/30",
              )}
            >
              <Target
                className={cn("size-3.5", isDisabled ? "stroke-slate-300" : "stroke-purple-400")}
              />
            </div>
            <p className="text-white/60 text-xs font-normal">{t("scores.priority")}</p>
          </div>
          {!isDisabled && (
            <div className="text-xs font-thin mt-2 [&_span]:text-white/50">
              {t("prioritySubtitle", { count })
                .split("|")
                .map((part, index, array) => (
                  <span key={index}>
                    {part}
                    {index < array.length - 1 && <br />}
                  </span>
                ))}
            </div>
          )}
        </div>

        {!isDisabled && (
          <div className="flex gap-1 mt-3">
            {Array.from({ length: displayCount }).map((_, index) => (
              <div
                key={index}
                className="h-1 flex-1 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
};
