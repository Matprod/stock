import type { Control, FieldValues, Path } from "react-hook-form";
import type { InputHTMLAttributes } from "react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";

interface NumberInputRhfProps<T extends FieldValues>
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange"
  > {
  onChange?: (value: number) => void;
  control: Control<T>;
  name: Path<T>;
  label?: string;
  type?: "number";
}

export function NumberInputRhf<T extends FieldValues>({
  control,
  name,
  label,
  onChange,
  ...props
}: NumberInputRhfProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input
              type="number"
              {...field}
              {...props}
              value={field.value === "" ? "" : field.value}
              onChange={(e) => {
                if (onChange) {
                  onChange(Number(e.target.value));
                } else {
                  const value = e.target.value;
                  if (value === "") {
                    field.onChange("");
                  } else if (Number(value) >= 0) {
                    field.onChange(Number(value));
                  }
                }
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
