import type { FC } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { CalendarIcon, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { twMerge } from "tailwind-merge";
import type { DateRange } from "./date-range-picker";

export interface FilterControlsProps {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  selectedPlayer: string | undefined;
  setSelectedPlayer: (player: string | undefined) => void;
  uniquePlayers: string[];
  onClearFilters: () => void;
  showClearButton?: boolean;
  className?: string;
  datePickerClassName?: string;
  playerSelectClassName?: string;
  clearButtonClassName?: string;
  minDate?: Date;
  maxDate?: Date;
}

const FilterControls: FC<FilterControlsProps> = ({
  dateRange,
  setDateRange,
  selectedPlayer,
  setSelectedPlayer,
  uniquePlayers,
  onClearFilters,
  showClearButton = true,
  className = "",
  datePickerClassName = "",
  playerSelectClassName = "",
  clearButtonClassName = "",
  minDate,
  maxDate,
}) => {
  const { t } = useTranslation("injury");

  const renderDateRangeButton = () => {
    if (!dateRange.from) {
      return <span>{t("pickDateRange")}</span>;
    }

    if (dateRange.to) {
      return (
        <>
          {dayjs(dateRange.from).format("MMM D, YYYY")} -{" "}
          {dayjs(dateRange.to).format("MMM D, YYYY")}
        </>
      );
    }

    return dayjs(dateRange.from).format("MMM D, YYYY");
  };

  const hasActiveFilters = dateRange.from || selectedPlayer;

  return (
    <div className={twMerge("flex items-center gap-4", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="lg"
            className={twMerge(
              "border-white/20 font-normal",
              !dateRange.from && "text-muted-foreground",
              datePickerClassName,
            )}
          >
            <CalendarIcon className="mr-2 size-5" />
            {renderDateRangeButton()}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-background-dark-blue border rounded-md shadow"
          align="center"
        >
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={dateRange}
            onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
            numberOfMonths={1}
            fromDate={minDate}
            toDate={maxDate}
          />
        </PopoverContent>
      </Popover>

      <Select
        value={selectedPlayer ?? "all"}
        onValueChange={(value) => setSelectedPlayer(value === "all" ? undefined : value)}
      >
        <SelectTrigger
          className={twMerge(
            "w-[180px] bg-transparent border border-white/20",
            playerSelectClassName,
          )}
        >
          <SelectValue placeholder={t("selectPlayer")} />
        </SelectTrigger>
        <SelectContent className="border-white/20">
          <SelectItem value="all">{t("allPlayers")}</SelectItem>
          {uniquePlayers.map((player) => (
            <SelectItem key={player} value={player}>
              {player}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showClearButton && hasActiveFilters && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearFilters}
          className={twMerge(
            "h-10 w-10 hover:bg-destructive/10 hover:text-destructive text-gray-100",
            clearButtonClassName,
          )}
        >
          <X className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};

export default FilterControls;
