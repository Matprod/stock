import * as React from "react";

import { cn } from "../../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number") {
        e.currentTarget.blur();
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full font-normal rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
          className,
        )}
        ref={ref}
        onWheel={handleWheel}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
