import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // v2: halo-yellow fill + ink-900 text is THE primary CTA (design-system-v2.md §6.2)
        default:
          "bg-[color:var(--halo-yellow)] text-[color:var(--ink-900)] hover:bg-[color:var(--halo-yellow-hover)]",
        secondary:
          "bg-[color:var(--ink-900)] text-[color:var(--paper-50)] hover:bg-[color:var(--ink-800)]",
        outline:
          "border border-[color:var(--ink-200)] bg-transparent text-[color:var(--ink-900)] hover:border-[color:var(--ink-900)] hover:bg-[color:var(--ink-100)]",
        ghost:
          "text-[color:var(--ink-900)] hover:bg-[color:var(--ink-100)]",
        link: "text-[color:var(--ink-900)] font-semibold underline decoration-2 decoration-[color:var(--halo-yellow)] underline-offset-4 hover:text-[color:var(--ink-600)]",
        destructive:
          "bg-[color:var(--risk-700)] text-white hover:bg-[color:var(--risk-900)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
