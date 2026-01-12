"use client";

import type { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../components/ui/form";
import { Input } from "../../components/ui/input";

interface InputRhfProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  className?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function InputRhf<T extends FieldValues>({
  control,
  name,
  label,
  className,
  type = "text",
  ...props
}: InputRhfProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input className={className} type={type} {...field} {...props} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
