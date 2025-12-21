import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold tracking-wide uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-line)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 active:translate-y-[1px]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border-2 border-[var(--color-line)] shadow-[4px_4px_0px_0px_var(--color-line)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_var(--color-line)]",
        secondary:
          "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] border-2 border-[var(--color-line)] shadow-[4px_4px_0px_0px_var(--color-line)] hover:-translate-y-0.5",
        neutral:
          "bg-[var(--color-card)] text-[var(--color-foreground)] border-2 border-[var(--color-line)] shadow-[4px_4px_0px_0px_var(--color-line)] hover:bg-[var(--color-sand)]",
        outline:
          "bg-transparent text-[var(--color-foreground)] border-2 border-[var(--color-line)] hover:bg-[var(--color-muted)]",
        ghost:
          "bg-transparent text-[var(--color-foreground)] border border-transparent hover:bg-black/5 active:translate-y-0",
        link:
          "text-[var(--color-primary)] underline-offset-4 hover:underline border-none shadow-none hover:translate-y-0 active:translate-y-0",
        destructive:
          "bg-red-500 text-white border-2 border-[var(--color-line)] shadow-[4px_4px_0px_0px_var(--color-line)] hover:bg-red-600",
      },
      size: {
        default: "h-11 px-6 rounded-[999px]",
        sm: "h-9 rounded-[18px] px-4 text-xs",
        lg: "h-14 rounded-[999px] px-8 text-base",
        icon: "h-11 w-11 rounded-[999px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
