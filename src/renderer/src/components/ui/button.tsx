import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  // DESIGN.md, "button-primary/secondary/tertiary":
  //   typography {typography.button-md}  16px / 600 / 24px
  //   rounded    {rounded.xl}  24px
  // The 24px pill is the brand signature - "Don't render CTAs as sharp
  // rectangles. The 24 px pill geometry is non-negotiable."
  //
  // Height: the brand spec is 12px/24px padding (48px tall) for the
  // marketing surface. Inside the app a 48px button beside a 24px switch
  // reads as two unrelated control families, so the in-app scale is
  // 40 / 32 / 28 - still generous, and it lines up with the select (40) and
  // the switch (24) that sit in the same rows.
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-3xl border border-transparent bg-clip-padding text-base font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
        // 36px - the default control height of the app
        default: "h-9 gap-2 px-5",
        // 28px - the utility tier: the small actions that sit inside a row
        // (Change, Delete all, Refresh) rather than heading a page.
        sm: "h-7 gap-1.5 px-3 text-sm",
        lg: "h-11 gap-2 px-6",
        // Circular icon button: {rounded.full}
        icon: "size-9 rounded-full",
        "icon-xs": "size-7 rounded-full",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-10 rounded-full",
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

/**
 * The ref is forwarded so the button can be used as a Radix trigger
 * (`asChild`). Radix anchors a dropdown to the trigger element, and it reads
 * that element through the ref - without one the menu has nothing to
 * position itself against and never appears.
 */
const ButtonWithRef = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }>(function Button(
  { className, variant = "default", size = "default", asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

export { ButtonWithRef as Button, buttonVariants }
