import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { useHoverWithDelay } from "../hooks/useHoverWithDelay";
import { twMerge } from "tailwind-merge";
import { Calendar } from "lucide-react";
import useGetSeasons from "../lib/query/seasons/get_seasons";
import { useSeasonStore } from "../store/season-store";
import { getCurrentSeason } from "../utils/get_current_season";
import { Skeleton } from "./ui/skeleton";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

export const SeasonSelector = () => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("common");
  const { handleMouseEnter, handleMouseLeave } = useHoverWithDelay(
    () => setOpen(true),
    () => setOpen(false),
  );
  const { data: seasons, isLoading } = useGetSeasons();
  const { selectedSeasonId, setSelectedSeasonId } = useSeasonStore();

  const currentSeason = (() => {
    if (!seasons) return undefined;
    if (selectedSeasonId) {
      return seasons.find((s) => s.id === selectedSeasonId) || getCurrentSeason(seasons, true);
    }
    return getCurrentSeason(seasons, true);
  })();

  const handleSeasonChange = (seasonId: number | null) => {
    setSelectedSeasonId(seasonId);
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-full border border-white/20 shadow flex items-center justify-center bg-primary/80">
        <Skeleton className="w-6 h-6 rounded" />
      </div>
    );
  }

  if (!seasons || seasons.length === 0) {
    return null;
  }

  const formatSeasonName = (season: typeof seasons[0]) => {
    if (season.name) {
      return season.name;
    }
    const startYear = dayjs(season.startDate).format("YYYY");
    const endYear = dayjs(season.endDate).format("YYYY");
    return `${startYear}-${endYear}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          className="w-10 h-10 rounded-full border border-white/20 shadow flex items-center justify-center bg-primary/80 hover:text-light-primary hover:bg-white/10 transition-all font-medium text-blue-100 text-xs select-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          title={currentSeason ? formatSeasonName(currentSeason) : t("selectSeason")}
        >
          <Calendar size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        sideOffset={8}
        className="p-2 bg-background-dark-blue min-w-[180px] max-h-[300px] overflow-y-auto flex flex-col gap-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {t("seasons")}
        </div>
        {seasons.map((season) => {
          const isSelected = selectedSeasonId === season.id || (!selectedSeasonId && season.id === currentSeason?.id);
          return (
            <button
              key={season.id}
              onClick={() => handleSeasonChange(season.id)}
              className={twMerge(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full text-left",
                isSelected
                  ? "bg-blue-500/20 text-blue-200 font-semibold"
                  : "hover:bg-white/10 text-blue-100",
              )}
            >
              <Calendar size={16} className={isSelected ? "text-blue-300" : "text-gray-400"} />
              <span className="text-sm">{formatSeasonName(season)}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

