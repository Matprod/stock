import type { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../components/ui/form";
import { Select } from "./select";

interface SelectRhfProps<TFieldValues extends FieldValues, TOption> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  options: TOption[];
  getOptionLabel: (option: TOption) => string;
  getOptionValue: (option: TOption) => string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

export function SelectRhf<TFieldValues extends FieldValues, TOption>({
  control,
  name,
  options,
  getOptionLabel,
  getOptionValue,
  label,
  placeholder,
  disabled,
  className,
  contentClassName = "bg-background-dark-blue text-base font-medium border-white/20",
}: SelectRhfProps<TFieldValues, TOption>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Select
              disabled={disabled}
              onValueChange={(val) => {
                field.onChange(val ?? "");
              }}
              value={(field.value?.toString() ?? "") as string}
              options={options}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              placeholder={placeholder}
              className={className}
              contentClassName={contentClassName}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
