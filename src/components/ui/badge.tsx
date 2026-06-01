import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.18em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary/10 text-primary",
        secondary:
          "border border-transparent bg-secondary/10 text-secondary",
        success:
          "border border-transparent bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]",
        warning:
          "border border-transparent bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]",
        risk: "border border-transparent bg-[color:var(--color-risk)]/10 text-[color:var(--color-risk)]",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
