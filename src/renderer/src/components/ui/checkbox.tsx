"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { CheckIcon } from "lucide-react"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Tuned to the app's old .row input[type=checkbox]: 20px square with
        // accent-color var(--positive). The checked state uses the positive
        // green, not the lime brand accent. `dark:bg-input/30` was dropped
        // because it was emitted after data-[state=checked]:bg-* and won, leaving
        // checked boxes looking empty in dark mode.
        //
        // State styles use data-[state=...] rather than the registry's
        // data-checked / data-unchecked shorthand. This Radix only writes
        // data-state, so the shorthand never matched and the fill had to be
        // mirrored onto the element by a MutationObserver - which made every
        // checkbox feel laggy and drop clicks. Do not "restore" the shorthand.
        "peer relative flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-input bg-background transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[state=checked]:border-positive data-[state=checked]:bg-positive data-[state=checked]:text-white dark:bg-[#101209] dark:aria-invalid:border-destructive/50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
