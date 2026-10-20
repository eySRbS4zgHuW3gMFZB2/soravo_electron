import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CloseIcon } from './icons'

type PageHeroProps = {
  title: ReactNode
  description: ReactNode
  /** The call-to-action button. */
  cta?: ReactNode
  /** Example chips rendered between the description and the CTA. */
  examples?: ReactNode
  /** Extra content pinned to the corner of the banner. */
  overlay?: ReactNode
  onDismiss?: () => void
  className?: string
}

/**
 * The hero band at the top of a hub page.
 *
 * DESIGN.md, "card-feature-dark": a near-black surface carrying the brand
 * green, with a 24px radius and 24px of padding.
 */
export function PageHero({
  title,
  description,
  cta,
  examples,
  overlay,
  onDismiss,
  className
}: PageHeroProps) {
  return (
    <div className={cn('page-hero', className)}>
      {onDismiss ? (
        <button
          type="button"
          className="page-hero-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <CloseIcon size={16} />
        </button>
      ) : null}
      <h2 className="page-hero-title">{title}</h2>
      <p className="page-hero-body">{description}</p>
      {examples ? <div className="page-hero-examples">{examples}</div> : null}
      {cta ? <div className="page-hero-cta">{cta}</div> : null}
      {overlay}
    </div>
  )
}
