import type { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../components/ui/form";
import { Button } from "../../components/ui/button";
import { Calendar } from "../../components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";

interface DateInputRhfProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  disablePast?: boolean;
}

export function DateInputRhf<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  disabled,
  className,
  disablePast,
}: DateInputRhfProps<TFieldValues>) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const locale = i18n.language === "fr" ? fr : enUS;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  className={cn(
                    "w-full bg-white/10 font-normal hover:bg-white/20",
                    !field.value && "text-muted-foreground",
                    className,
                  )}
                  disabled={disabled}
                >
                  {field.value ? (
                    format(field.value as Date, "PPP", { locale })
                  ) : (
                    <span>{placeholder ?? "Sélectionner une date"}</span>
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
                selected={field.value as Date}
                onSelect={(date) => {
                  field.onChange(date ?? undefined);
                  setOpen(false);
                }}
                disabled={(date) =>
                  disablePast ? date < new Date(new Date().setHours(0, 0, 0, 0)) : false
                }
                initialFocus
                locale={locale}
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
