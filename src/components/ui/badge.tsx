import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-2 px-2.5 py-0.5 text-[11px] font-mono font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-line)] bg-[var(--color-secondary)] text-[var(--color-foreground)] shadow-[2px_2px_0px_0px_var(--color-line)]",
        secondary:
          "border-[var(--color-line)] bg-[var(--color-accent)] text-[var(--color-foreground)] shadow-[2px_2px_0px_0px_var(--color-line)]",
        neutral:
          "border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-foreground)] shadow-[2px_2px_0px_0px_var(--color-line)]",
        outline:
          "border-[var(--color-line)] text-[var(--color-foreground)] bg-transparent",
        destructive:
          "border-[var(--color-line)] bg-red-500 text-white shadow-[2px_2px_0px_0px_var(--color-line)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
