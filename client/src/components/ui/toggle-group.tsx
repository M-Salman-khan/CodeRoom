import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium transition-all hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:border-primary/30",
  {
    variants: {
      variant: {
        default: "bg-transparent text-muted-foreground",
        outline:
          "border border-border bg-transparent text-muted-foreground hover:bg-secondary",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-7 px-2",
        lg: "h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex items-center gap-0.5 rounded-xl border border-border/70 bg-surface/50 p-0.5",
      className
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(toggleVariants({ variant, size }), className)}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem, toggleVariants };
