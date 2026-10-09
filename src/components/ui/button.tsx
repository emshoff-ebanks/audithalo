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
          "bg-[color:var(--ink-900)] text-[color:var(--paper-50)] hover:bg-[color:var(--ink-800)] dark:bg-[color:var(--paper-50)] dark:text-[color:var(--ink-900)] dark:hover:bg-[color:var(--ink-200)]",
        // Neutral variants author against flipping tokens so they stay legible
        // in dark mode (design-system-v2.md §3.2, §6.2).
        outline:
          "border border-[color:var(--border)] bg-transparent text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)]",
        ghost:
          "text-[color:var(--text-primary)] hover:bg-[color:var(--surface-muted)]",
        link: "text-[color:var(--text-primary)] font-semibold underline decoration-2 decoration-[color:var(--halo-yellow)] underline-offset-4 hover:text-[color:var(--text-secondary)]",
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
