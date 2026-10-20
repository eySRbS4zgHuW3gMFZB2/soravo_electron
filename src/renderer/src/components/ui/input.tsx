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
        //   padding    {spacing.md} {spacing.lg}  12px 16px
        //   rounded    {rounded.md}  12px
        //   borderColor {colors.ink}
        "flex w-full min-w-0 items-center rounded-xl border border-input bg-background px-4 py-3 text-base font-normal text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-[#101209] dark:aria-invalid:border-destructive/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
