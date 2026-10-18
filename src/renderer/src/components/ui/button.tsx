import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  // Tuned to match the app's previous .btn: 12px radius, 8px/16px padding,
  // 14px semibold text, no border. Do not reset these to shadcn defaults
  // without also updating the design tokens.
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Lime: the app's old .btn.primary
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        // Canvas surface: the app's old .btn
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        // Solid red: the app's old .btn.danger
        destructive: "bg-destructive text-white hover:bg-destructive/85",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Matches the old .btn box exactly: 8px vertical, 16px horizontal.
        default: "h-auto gap-1.5 px-4 py-2",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs",
        sm: "h-7 gap-1 rounded-lg px-2.5 text-[0.8rem]",
        lg: "h-auto gap-1.5 px-4 py-2",
        icon: "size-8 rounded-xl",
        "icon-xs": "size-6 rounded-lg",
        "icon-sm": "size-7 rounded-lg",
        "icon-lg": "size-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
