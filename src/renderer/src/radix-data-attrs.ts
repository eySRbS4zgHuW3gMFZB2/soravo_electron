/**
 * Bridge shadcn's data-attribute names to the ones this Radix version emits.
 *
 * The current shadcn components target a newer Radix that writes boolean
 * attributes such as `data-checked`, `data-open`, `data-closed` and
 * `data-unchecked`. The installed Radix only writes `data-state`
 * ("checked" | "unchecked" | "open" | "closed"), so every style keyed on the
 * boolean attributes silently never applies - checked checkboxes render empty,
 * and dialog/select/tooltip open animations never run.
 *
 * Rather than patching each generated component (which the shadcn CLI would
 * revert on the next `add`/`update`), mirror the attributes once here.
 */

type Mapping = Record<string, string>

const STATE_TO_ATTR: Mapping = {
  checked: 'data-checked',
  unchecked: 'data-unchecked',
  open: 'data-open',
  closed: 'data-closed',
}

const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_TO_ATTR).map(([state, attr]) => [attr, state])
)

function sync(el: Element) {
  // data-state -> the boolean aliases Radix does not write.
  const state = el.getAttribute('data-state')
  if (state && STATE_TO_ATTR[state]) {
    el.setAttribute(STATE_TO_ATTR[state], '')
  }
  for (const attr of Object.keys(STATE_TO_ATTR)) {
    if (attr !== state && el.hasAttribute(STATE_TO_ATTR[attr])) {
      el.removeAttribute(STATE_TO_ATTR[attr])
    }
  }

  // data-orientation -> data-horizontal / data-vertical (ToggleGroup).
  const orientation = el.getAttribute('data-orientation')
  if (orientation === 'horizontal') {
    el.setAttribute('data-horizontal', '')
    el.removeAttribute('data-vertical')
  } else if (orientation === 'vertical') {
    el.setAttribute('data-vertical', '')
    el.removeAttribute('data-horizontal')
  }
}

export function installRadixDataAttrs() {
  const scan = () => {
    document
      .querySelectorAll('[data-state], [data-orientation]')
      .forEach((el) => sync(el))
  }

  scan()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const el of record.addedNodes) {
        if (el instanceof Element) {
          if (el.hasAttribute('data-state') || el.hasAttribute('data-orientation')) {
            sync(el)
          }
          el
            .querySelectorAll('[data-state], [data-orientation]')
            .forEach((node) => sync(node))
        }
      }
    }
  })

  observer.observe(document.documentElement, { subtree: true, childList: true })
  return () => observer.disconnect()
}

export { REVERSE as RADIX_STATE_ATTRIBUTE_MAP }