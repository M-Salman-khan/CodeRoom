import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-background/60 px-3.5 py-2 text-sm text-foreground shadow-sm transition-all",
          "placeholder:text-muted placeholder:opacity-60",
          "hover:border-accent/60",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
