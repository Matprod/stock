"use client";

import { fr, enUS } from "date-fns/locale";
import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { twMerge } from "tailwind-merge";

interface DatePickerProps {
  dates: Date[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  triggerClassName?: string;
}

export const DatePicker = ({
  dates,
  currentDate,
  onDateChange,
  triggerClassName,
}: DatePickerProps) => {
  const { i18n } = useTranslation();
  const [date, setDate] = useState<Date | undefined>(currentDate);
  const [month, setMonth] = useState<Date>(currentDate);
  const locale = i18n.language === "fr" ? fr : enUS;

  useEffect(() => {
    setDate(currentDate);
    setMonth(currentDate);
  }, [currentDate]);

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate);
      onDateChange(newDate);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={twMerge("w-32 text-center font-normal", triggerClassName)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dayjs(date).isSame(dayjs().subtract(1, "day"), "day")
            ? "Today"
            : dayjs(date).format("DD/MM/YYYY")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-background-dark-blue border rounded-md shadow-xl"
        align="center"
        side="bottom"
        sideOffset={8}
        alignOffset={0}
        avoidCollisions={false}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          month={month}
          onMonthChange={setMonth}
          disabled={(date) => {
            return !dates.some(
              (d) => dayjs(d).format("YYYY-MM-DD") === dayjs(date).format("YYYY-MM-DD"),
            );
          }}
          initialFocus
          className="rounded-md"
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  );
};
