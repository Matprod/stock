import { cva } from "class-variance-authority";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export interface ScoreCardProps {
  score?: number;
  label: string;
  selected: boolean;
  href: string;
}

const getColorScheme = (
  score: number | null | undefined,
): "green" | "yellow" | "red" | "default" => {
  if (score === null || score === undefined) return "default";

  if (score >= 60) return "green";
  if (score >= 30) return "yellow";
  return "red";
};

type ColorVariant = "default" | "green" | "yellow" | "red";

const PROGRESS_COLORS: Record<ColorVariant, string> = {
  default: "bg-slate-600",
  green: "bg-emerald-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
} as const;

const containerVariants = cva(
  "relative bg-gradient-to-br border border-white/10 rounded-xl p-4 transition-all duration-300 overflow-hidden w-full hover:bg-white/5",
  {
    variants: {
      variant: {
        default: "bg-[#252D3B]",
        green: "from-emerald-500/20 to-green-600/20 border-emerald-500/40",
        yellow: "from-yellow-500/20 to-amber-600/20 border-yellow-500/40",
        red: "from-red-600/20 to-rose-600/20 border-red-500/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const textColorVariants = cva("text-4xl", {
  variants: {
    variant: {
      default: "text-slate-500",
      green: "text-emerald-400",
      yellow: "text-yellow-400",
      red: "text-red-400",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const ScoreCard = ({ score, label, selected, href }: ScoreCardProps) => {
  const isDisabled = score == null;
  const variant = getColorScheme(score);

  return (
    <Link
      to={href}
      className={cn("w-30", isDisabled && "pointer-events-none opacity-40")}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
        }
      }}
    >
      <div
        className={cn(
          containerVariants({
            variant: selected ? variant : "default",
          }),
          selected && variant === "default" && "bg-[#252D3B] border-slate-600",
        )}
      >
        <div className="mb-3">
          <p className="text-white/60 text-xs font-normal mb-3">{label}</p>
          <div className={cn(textColorVariants({ variant }))}>{score ?? "--"}</div>
        </div>

        {!isDisabled ? (
          <div className="h-1 bg-slate-900/40 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                PROGRESS_COLORS[variant],
              )}
              style={{
                width: `${score}%`,
              }}
            />
          </div>
        ) : (
          <div className="h-1" />
        )}
      </div>
    </Link>
  );
};
