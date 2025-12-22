import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-border shadow-sm hover:opacity-90 active:translate-y-[1px]",
        secondary:
          "bg-secondary text-secondary-foreground border border-border shadow-sm hover:bg-muted active:translate-y-[1px]",
        outline:
          "bg-transparent text-foreground border border-border hover:bg-muted active:translate-y-[1px]",
        ghost:
          "bg-transparent text-foreground border border-transparent hover:bg-black/5",
        link:
          "text-foreground underline-offset-4 hover:underline border-none shadow-none",
        destructive:
          "bg-red-500 text-white border border-red-600 shadow-sm hover:bg-red-600 active:translate-y-[1px]",
      },
      size: {
        default: "h-11 px-5 rounded-full",
        sm: "h-9 rounded-full px-3 text-xs",
        lg: "h-14 rounded-full px-7 text-base",
        icon: "h-11 w-11 rounded-full",
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

export { Button }
