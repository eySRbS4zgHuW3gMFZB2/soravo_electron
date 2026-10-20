import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type WisprTab = { key: string; label: string }

type WisprTabsProps = {
  tabs: WisprTab[]
  activeKey: string
  onChange: (key: string) => void
  /** Controls rendered on the right of the tab strip. */
  utils?: ReactNode
  className?: string
  /** Pins the strip to the top of the scrolling region. */
  sticky?: boolean
  'data-testid'?: string
}

/**
 * The underline tab strip used by the Wispr Flow Snippets and Scratchpad
 * pages.
 *
 * The 2px active indicator is a pseudo-element on the container whose width
 * and offset are published as CSS variables, so it can slide between tabs.
 * The measurement mirrors the shipped implementation: the indicator spans the
 * label only, so the tab's horizontal padding is subtracted.
 */
export function WisprTabs({
  tabs,
  activeKey,
  onChange,
  utils,
  className,
  sticky,
  'data-testid': testIdPrefix
}: WisprTabsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [animated, setAnimated] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const selected = el.querySelector<HTMLElement>('.wispr-tab-selected')
    if (!selected) {
      el.style.setProperty('--wispr-tab-width', '0px')
      el.style.setProperty('--wispr-tab-left', '0px')
      return
    }
    const rect = selected.getBoundingClientRect()
    const parent = el.getBoundingClientRect()
    const scale = parent.width / parseFloat(getComputedStyle(el).width) || 1
    const styles = getComputedStyle(selected)
    const padLeft = parseFloat(styles.paddingLeft) || 0
    const padRight = parseFloat(styles.paddingRight) || 0
    el.style.setProperty(
      '--wispr-tab-width',
      `${rect.width / scale - padLeft - padRight}px`
    )
    el.style.setProperty(
      '--wispr-tab-left',
      `${(rect.left - parent.left) / scale + padLeft}px`
    )
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure, activeKey, tabs])

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(el)
    el.querySelectorAll('.wispr-tab').forEach((tab) => observer.observe(tab))
    return () => observer.disconnect()
  }, [measure])

  const onKeyDown = (event: React.KeyboardEvent, key: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onChange(key)
      return
    }
    const index = tabs.findIndex((t) => t.key === activeKey)
    if (index === -1) return
    let next = index
    if (event.key === 'ArrowRight') next = index + 1
    else if (event.key === 'ArrowLeft') next = index - 1
    else return
    if (next < 0 || next >= tabs.length) return
    event.preventDefault()
    onChange(tabs[next].key)
    ref.current
      ?.querySelector<HTMLElement>(`[data-tab-key="${tabs[next].key}"]`)
      ?.focus()
  }

  return (
    <div
      ref={ref}
      className={cn('wispr-tabs', animated && 'wispr-tabs-animated', sticky && 'wispr-tabs-sticky', className)}
      role="tablist"
      data-testid={testIdPrefix}
    >
      <div className="wispr-tabs-wrapper">
        {tabs.map((tab) => {
          const selected = tab.key === activeKey
          return (
            <div
              key={tab.key}
              id={`tab-v2-${tab.key}`}
              data-tab-key={tab.key}
              data-active={selected || undefined}
              className={cn('wispr-tab', selected && 'wispr-tab-selected')}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => onKeyDown(event, tab.key)}
            >
              {tab.label}
            </div>
          )
        })}
      </div>
      {utils ? <div className="wispr-utils">{utils}</div> : null}
    </div>
  )
}
