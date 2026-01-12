import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { DatePicker } from "./date-picker";
import dayjs, { type Dayjs } from "dayjs";
import { useDateStore } from "../../store/date-store";

interface DateNavigationProps {
  daysWithStats: Dayjs[];
  selectedDate: Dayjs;
  currentDayIndex: number | null;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onDateChange: (date: Dayjs) => void;
  type: "athlete" | "team";
}

export const DateNavigation = ({
  daysWithStats,
  selectedDate,
  currentDayIndex,
  onPreviousDay,
  onNextDay,
  onDateChange,
  type,
}: DateNavigationProps) => {
  const { setAthleteDate, setTeamDate } = useDateStore();
  const dates = daysWithStats.map((date) => date.toDate());

  const handleDateChange = (date: Date) => {
    const dayjsDate = dayjs(date);
    onDateChange(dayjsDate);
    const formattedDate = dayjsDate.format("YYYY-MM-DD");
    if (type === "athlete") {
      setAthleteDate(formattedDate);
    } else {
      setTeamDate(formattedDate);
    }
  };

  const handlePreviousDay = () => {
    onPreviousDay();
    if (currentDayIndex !== null && currentDayIndex > 0) {
      const newDate = daysWithStats[currentDayIndex - 1];
      const formattedDate = newDate.format("YYYY-MM-DD");
      if (type === "athlete") {
        setAthleteDate(formattedDate);
      } else {
        setTeamDate(formattedDate);
      }
    }
  };

  const handleNextDay = () => {
    onNextDay();
    if (currentDayIndex !== null && currentDayIndex < daysWithStats.length - 1) {
      const newDate = daysWithStats[currentDayIndex + 1];
      const formattedDate = newDate.format("YYYY-MM-DD");
      if (type === "athlete") {
        setAthleteDate(formattedDate);
      } else {
        setTeamDate(formattedDate);
      }
    }
  };

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePreviousDay}
        disabled={currentDayIndex === 0}
        className="hover:bg-white/10"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <DatePicker
        dates={dates}
        currentDate={selectedDate?.toDate()}
        onDateChange={handleDateChange}
        triggerClassName="border-transparent"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextDay}
        disabled={currentDayIndex === daysWithStats.length - 1}
        className="hover:bg-white/10"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
