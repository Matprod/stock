import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command";
import { Check } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface MultiSelectProps<T> {
  options: T[];
  selected: T[];
  onChange: (selected: T[]) => void;
  getLabel: (option: T) => string;
  getValue: (option: T) => string | number;
  buttonText?: (count: number) => string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  popoverClassName?: string;
  disabled?: (option: T) => boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export const MultiSelect = <T,>({
  options,
  selected,
  onChange,
  getLabel,
  getValue,
  buttonText,
  placeholder,
  emptyText,
  className,
  popoverClassName,
  disabled,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: MultiSelectProps<T>) => {
  const { t } = useTranslation("common");
  const [internalOpen, setInternalOpen] = useState(false);

  const defaultButtonText =
    buttonText ??
    ((count) => (count === 0 ? t("select.select") : `${count} ${t("select.selected")}`));
  const defaultPlaceholder = placeholder ?? t("select.search");
  const defaultEmptyText = emptyText ?? t("noResultsFound");
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const isSelected = (option: T) => selected.some((item) => getValue(item) === getValue(option));

  const toggle = (option: T) => {
    if (disabled?.(option)) return;
    const value = getValue(option);
    onChange(
      isSelected(option)
        ? selected.filter((item) => getValue(item) !== value)
        : [...selected, option],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={twMerge("justify-between min-w-[200px]", className)}
          >
            {defaultButtonText(selected.length)}
            {selected.length > 0 && <div className="rounded-full bg-primary w-2 h-2 ml-2" />}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className={twMerge("p-0 w-[var(--radix-popover-trigger-width)]", popoverClassName)}
        align="start"
      >
        <Command>
          <CommandInput placeholder={defaultPlaceholder} />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>{defaultEmptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selectedItem = isSelected(option);
                const isDisabled = disabled?.(option) ?? false;
                return (
                  <CommandItem
                    key={String(getValue(option))}
                    value={getLabel(option)}
                    onSelect={() => toggle(option)}
                    disabled={isDisabled}
                    className={twMerge("cursor-pointer", isDisabled && "opacity-50")}
                  >
                    <Check
                      className={twMerge(
                        "mr-2 h-4 w-4",
                        selectedItem ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {getLabel(option)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
