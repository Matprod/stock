import { CalendarIcon, Clock } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@radix-ui/react-popover";
import { Input } from "../../../../components/ui/input";
import { Calendar } from "../../../../components/ui/calendar";
import { cn } from "../../../../lib/utils";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useFormContext } from "react-hook-form";
import type { WorkoutSessionData } from "../../schemas/workout_schema";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const DateConfiguration = () => {
  const [dateOpen, setDateOpen] = useState(false);
  const { t, i18n } = useTranslation("workout");
  const {
    control,
    formState: { errors },
  } = useFormContext<WorkoutSessionData>();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {t("sessionStart.sessionDate")}
            </FormLabel>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    {field.value ? (
                      format(field.value, "PPP", { locale: i18n.language === "fr" ? fr : enUS })
                    ) : (
                      <span>{t("sessionStart.selectDate")}</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 bg-background-dark-blue border rounded-md shadow-md"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={(date) => {
                    field.onChange(date);
                    setDateOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  locale={i18n.language === "fr" ? fr : enUS}
                />
              </PopoverContent>
            </Popover>
            {errors.date && (
              <p className="text-sm font-medium text-destructive">{errors.date.message}</p>
            )}
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="time"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("sessionStart.sessionTime")}
            </FormLabel>
            <FormControl>
              <Input type="time" {...field} className="w-full" />
            </FormControl>
            {errors.time && (
              <p className="text-sm font-medium text-destructive">{errors.time.message}</p>
            )}
          </FormItem>
        )}
      />
    </div>
  );
};

export default DateConfiguration;
