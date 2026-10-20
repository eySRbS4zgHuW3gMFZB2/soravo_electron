import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CloseIcon } from './icons'

type WisprBannerProps = {
  /** Background image shown behind the banner. */
  image: string
  title: ReactNode
  description: ReactNode
  /** The call-to-action button. */
  cta?: ReactNode
  /** Example chips rendered between the description and the CTA. */
  examples?: ReactNode
  /** Extra content pinned to the bottom-right of the banner. */
  overlay?: ReactNode
  onDismiss?: () => void
  compact?: boolean
  className?: string
}

/**
 * The hero card at the top of the Wispr Flow Snippets and Scratchpad pages.
 *
 * The photo sits behind a stacked, blurred card; the copy on top is EB
 * Garamond at 36px for the title and 15px for the description.
 */
export function WisprBanner({
  image,
  title,
  description,
  cta,
  examples,
  overlay,
  onDismiss,
  compact,
  className
}: WisprBannerProps) {
  return (
    <div className={cn('wispr-banner', compact && 'wispr-banner-compact', className)}>
      <div className="wispr-banner-background">
        <img className="wispr-banner-image" src={image} alt="" aria-hidden="true" />
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="wispr-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <CloseIcon size={18} />
        </button>
      ) : null}
      <div className="wispr-banner-content">
        <h2 className="wispr-banner-title">{title}</h2>
        <p className="wispr-banner-description">{description}</p>
        {examples ? <div className="wispr-banner-examples">{examples}</div> : null}
        {cta ? <div className="wispr-banner-cta">{cta}</div> : null}
      </div>
      {overlay}
    </div>
  )
}

