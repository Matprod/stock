import type { FC } from "react";
import dayjs from "dayjs";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { CalendarIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  placeholder?: string;
  dateFormat?: string;
  className?: string;
  buttonClassName?: string;
  popoverClassName?: string;
  align?: "start" | "center" | "end";
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

export const DateRangePicker: FC<DateRangePickerProps> = ({
  dateRange,
  onDateRangeChange,
  placeholder,
  dateFormat = "MMM D, YYYY",
  className,
  buttonClassName,
  popoverClassName,
  align = "center",
  buttonVariant = "outline",
  buttonSize = "lg",
}) => {
  const formatDate = (date: Date) => dayjs(date).format(dateFormat);

  const getDisplayText = () => {
    if (!dateRange.from) {
      return placeholder;
    }
    if (dateRange.to) {
      return `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`;
    }
    return formatDate(dateRange.from);
  };

  const displayText = getDisplayText();

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={buttonVariant}
            size={buttonSize}
            className={twMerge(
              "justify-start text-left font-medium",
              !dateRange.from && "text-muted-foreground",
              buttonClassName,
            )}
          >
            <CalendarIcon className="mr-2 h-5 w-5" />
            {displayText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className={twMerge("w-auto p-0", popoverClassName)} align={align}>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={dateRange}
            onSelect={(range) => onDateRangeChange({ from: range?.from, to: range?.to })}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
