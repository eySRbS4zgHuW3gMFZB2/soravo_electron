import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // DESIGN.md, text-input primitive:
        //   typography {typography.body-md}  16px / 400 / 24px
        //   rounded    {rounded.md}  12px
        //   borderColor {colors.ink}
        // rounded-lg is 12px here: the theme sets --radius to 0.75rem, so
        // rounded-lg is exactly 12px while rounded-xl would be 16.8px.
        //
        // Height is 40px, the same as the default button, so a settings row
        // with a field, a select and a switch reads as one control family.
        "flex h-10 w-full min-w-0 items-center rounded-lg border border-input bg-background px-4 text-base font-normal text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-[#101209] dark:aria-invalid:border-destructive/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
