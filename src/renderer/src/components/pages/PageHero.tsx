import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CloseIcon } from './icons'

/**
 * The gradient slot the band paints.
 *
 * Wispr Flow's bands use licensed photography. Soravo ships gradients so the
 * artwork can be replaced later without touching the layout - see the HERO
 * IMAGERY note at the top of hub.css for how to swap one in.
 */
export type HeroMedia = 'flow' | 'snippets' | 'dictionary' | 'scratchpad'

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
  /** Picks the gradient slot. */
  media?: HeroMedia
  className?: string
}

/**
 * The hero band at the top of a hub page.
 *
 * DESIGN.md, "card-feature-dark": a near-black surface carrying the brand
 * green, with a 24px radius and 24px of padding. In dark mode the band
 * inverts to the light sage surface so the lime accent keeps its contrast.
 */
export function PageHero({
  title,
  description,
  cta,
  examples,
  overlay,
  onDismiss,
  media = 'flow',
  className
}: PageHeroProps) {
  return (
    <div className={cn('page-hero', className)} data-media={media}>
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
