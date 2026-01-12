import {
  Select as SelectPrimitive,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { twMerge } from "tailwind-merge";

interface SelectProps<TOption, TValue extends string = string> {
  value?: TValue;
  onValueChange?: (value: TValue) => void;
  options: readonly TOption[];
  getOptionLabel: (option: TOption) => string;
  getOptionValue: (option: TOption) => TValue;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

export function Select<TOption, TValue extends string = string>({
  value,
  onValueChange,
  options,
  getOptionLabel,
  getOptionValue,
  placeholder,
  disabled,
  className,
  contentClassName = "bg-background-dark-blue text-base font-medium border-white/20",
}: SelectProps<TOption, TValue>) {
  return (
    <SelectPrimitive disabled={disabled} onValueChange={onValueChange} value={value}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className={twMerge(
          "min-w-[var(--radix-select-trigger-width)] max-w-[min(500px,90vw)] w-auto max-h-[--radix-select-content-available-height] overflow-y-auto overflow-x-hidden",
          contentClassName,
        )}
      >
        {options.map((option, index) => {
          const optionValue = getOptionValue(option);
          const labelText = getOptionLabel(option);
          return (
            <SelectItem key={optionValue ?? index} value={optionValue}>
              {labelText}
            </SelectItem>
          );
        })}
      </SelectContent>
    </SelectPrimitive>
  );
}
