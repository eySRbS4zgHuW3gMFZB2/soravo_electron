import { useMemo, useState } from 'react'
import type { InsightsData } from '../soravo'
import { PageTabs } from '@/components/pages/PageTabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/pages/icons'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WINDOW_WEEKS = 26
const HEATMAP_CELL = 13
const HEATMAP_GAP = 3

function WpmGauge({ avg, top }: { avg: number; top: number }) {
  const R = 88
  const ARC = Math.PI * R
  const scale = 200
  const frac = Math.min(1, avg / scale)
  const topFrac = Math.min(1, top / scale)
  const dotX = 100 - R * Math.cos(Math.PI * topFrac)
  const dotY = 100 - R * Math.sin(Math.PI * topFrac)
  return (
    <svg viewBox="0 0 200 112" className="gauge-svg">
      <path
        d="M 12 100 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="var(--soravo-canvas)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 12 100 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="var(--soravo-primary)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${(ARC * frac).toFixed(1)} ${ARC.toFixed(1)}`}
      />
      {top > 0 ? <circle cx={dotX} cy={dotY} r="5" fill="var(--soravo-ink)" /> : null}
    </svg>
  )
}

type InsightsPageProps = {
  insights: InsightsData | null
}

/**
 * The Insights page.
 *
 * Wispr Flow's Insights page is a tabbed dashboard: a row of summary cards, a
 * usage breakdown and a streak heat-map. Soravo has no per-application
 * breakdown, so the usage card shows the rhythm of dictation instead, and the
 * per-application slot is filled by the "your voice" tab.
 */
export default function InsightsPage({ insights }: InsightsPageProps) {
  const [tab, setTab] = useState('usage')
  const [weekOffset, setWeekOffset] = useState(0)
  const [rhythm, setRhythm] = useState<'hour' | 'weekday' | 'month' | 'year'>('hour')

  const grid = useMemo(() => {
    if (!insights) return null
    const byDate = new Map(insights.perDay.map((d) => [d.date, d.words]))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setDate(end.getDate() - weekOffset * 7)
    const endSunday = new Date(end)
    endSunday.setDate(endSunday.getDate() - end.getDay())
    const gridStart = new Date(endSunday)
    gridStart.setDate(endSunday.getDate() - 7 * (WINDOW_WEEKS - 1))
    const maxDay = Math.max(1, ...byDate.values())
    const level = (w: number) =>
      w === 0 ? 0 : w <= maxDay * 0.25 ? 1 : w <= maxDay * 0.5 ? 2 : w <= maxDay * 0.75 ? 3 : 4
    const weeks: Array<Array<{ date: Date; words: number } | null>> = []
    for (let w = 0; w < WINDOW_WEEKS; w++) {
      const col: Array<{ date: Date; words: number } | null> = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + w * 7 + d)
        if (date.getTime() > today.getTime()) {
          col.push(null)
        } else {
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          col.push({ date, words: byDate.get(key) ?? 0 })
        }
      }
      weeks.push(col)
    }
    const monthSections: { label: string; span: number; year: number }[] = []
    for (let i = 0; i < weeks.length; i++) {
      const cells = weeks[i].filter((c) => c !== null)
      if (cells.length === 0) continue
      const last = cells[cells.length - 1].date
      const m = last.getMonth()
      const y = last.getFullYear()
      const prev = monthSections[monthSections.length - 1]
      if (prev && prev.label === MONTHS[m] && prev.year === y) {
        prev.span += 1
      } else {
        monthSections.push({ label: MONTHS[m], span: 1, year: y })
      }
    }
    const oldest = insights.perDay.length > 0 ? insights.perDay[0].date : null
    const canEarlier = oldest !== null && gridStart > new Date(`${oldest}T00:00:00`)
    const gridYear =
      gridStart.getFullYear() === endSunday.getFullYear()
        ? String(gridStart.getFullYear())
        : `${gridStart.getFullYear()}-${endSunday.getFullYear()}`
    return { weeks, monthSections, level, canEarlier, gridYear }
  }, [insights, weekOffset])

  if (!insights || !grid) {
    return (
      <div className="page">
        <div className="page-head">
          <h1 className="page-head-title">Insights</h1>
        </div>
        <div className="page-scroll">
          <div className="page-column">
            <div className="page-empty">
              <p className="page-empty-title">Loading your insights</p>
              <p className="page-empty-body">Your dictation history is being summarised on this device.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const maxHour = Math.max(1, ...insights.perHour)
  const maxWeekday = Math.max(1, ...insights.perWeekday)
  const maxMonth = Math.max(1, ...insights.perMonth)
  const maxYear = Math.max(1, ...insights.perYear.map((e) => e.words))
  const maxWord = Math.max(1, ...insights.topWords.map((w) => w.count))
  const yearData =
    insights.perYear.length > 0 ? insights.perYear : [{ year: new Date().getFullYear(), words: 0 }]
  const hourLabel = (h: number) => (h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-head-title">Insights</h1>
      </div>

      <div className="page-scroll">
        <div className="page-column">
          <div className="page-stack">
            <PageTabs
              tabs={[
                { key: 'usage', label: 'Your usage' },
                { key: 'voice', label: 'Your voice' }
              ]}
              activeKey={tab}
              onChange={setTab}
            />

            {tab === 'usage' ? (
              <>
                <div className="insights-grid">
                  <div className="insights-card gauge-card">
                    <p className="insights-card-value">{insights.avgWpm}</p>
                    <p className="insights-card-kicker">words per minute</p>
                    <WpmGauge avg={insights.avgWpm} top={insights.topWpm} />
                    <p className="gauge-top">
                      {insights.topWpm > 0 ? `Top ${insights.topWpm} wpm` : 'Dictate to set a top speed'}
                    </p>
                  </div>

                  <div className="insights-card">
                    <p className="insights-card-value">{insights.correctionsFillers + insights.correctionsVocab}</p>
                    <p className="insights-card-kicker">fixes made by Soravo</p>
                    <p className="insights-card-note" style={{ marginTop: 12 }}>
                      {insights.correctionsFillers} filler word{insights.correctionsFillers === 1 ? '' : 's'} removed
                    </p>
                    <p className="insights-card-note">{insights.correctionsVocab} vocabulary fix{insights.correctionsVocab === 1 ? '' : 'es'}</p>
                  </div>

                  <div className="insights-card">
                    <p className="insights-card-value">{insights.words}</p>
                    <p className="insights-card-kicker">total words dictated</p>
                    <div className="rail-stats" style={{ marginTop: 14 }}>
                      <div className="rail-stat">
                        <span className="rail-stat-value" style={{ fontSize: 20 }}>
                          {insights.dictations}
                        </span>
                        <span className="rail-stat-label">dictations</span>
                      </div>
                      <div className="rail-stat">
                        <span className="rail-stat-value" style={{ fontSize: 20 }}>
                          {insights.audioMinutes}
                        </span>
                        <span className="rail-stat-label">minutes dictated</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="insights-grid-duo">
                  <div className="insights-card">
                    <div className="insights-card-head">
                      <h2 className="insights-card-title">When you dictate</h2>
                    </div>
                    <ToggleGroup
                      type="single"
                      value={rhythm}
                      onValueChange={(v) => v && setRhythm(v as typeof rhythm)}
                      variant="outline"
                      spacing={0}
                      className="seg"
                    >
                      <ToggleGroupItem value="hour">Hour</ToggleGroupItem>
                      <ToggleGroupItem value="weekday">Week</ToggleGroupItem>
                      <ToggleGroupItem value="month">Month</ToggleGroupItem>
                      <ToggleGroupItem value="year">Year</ToggleGroupItem>
                    </ToggleGroup>
                    {rhythm === 'hour' ? (
                      <div className="hub-bars">
                        {insights.perHour.map((w, h) => (
                          <div className="hub-bar-col" key={h} title={`${hourLabel(h)}: ${w} words`}>
                            <div className="hub-bar" style={{ height: `${Math.max(3, Math.round((w / maxHour) * 72))}px` }} />
                            <span>{h % 3 === 0 ? hourLabel(h) : ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : rhythm === 'weekday' ? (
                      <div className="hub-bars">
                        {insights.perWeekday.map((w, i) => (
                          <div className="hub-bar-col" key={WEEKDAYS[i]} title={`${WEEKDAYS[i]}: ${w} words`}>
                            <div className="hub-bar" style={{ height: `${Math.max(3, Math.round((w / maxWeekday) * 72))}px` }} />
                            <span>{WEEKDAYS[i]}</span>
                          </div>
                        ))}
                      </div>
                    ) : rhythm === 'month' ? (
                      <div className="chart">
                        <div className="hub-bars">
                          {insights.perMonth.map((w, i) => (
                            <div className="hub-bar-col" key={MONTHS[i]} title={`${MONTHS[i]}: ${w} words`}>
                              <div className="hub-bar" style={{ height: `${Math.max(3, Math.round((w / maxMonth) * 72))}px` }} />
                              <span>{MONTHS[i]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="chart">
                        <div className="hub-bars">
                          {yearData.map((e) => (
                            <div className="hub-bar-col" key={e.year} title={`${e.year}: ${e.words} words`}>
                              <div
                                className="hub-bar"
                                style={{ height: `${Math.max(3, Math.round((e.words / maxYear) * 72))}px` }}
                              />
                              <span>{e.year}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="insights-card">
                    <div className="insights-card-head">
                      <h2 className="insights-card-title">{insights.dayStreak} day streak</h2>
                      <span className="insights-card-kicker">
                        longest streak | {insights.longestStreak} {insights.longestStreak === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <div className="hub-heatmap-card">
                      <div className="heatmap-navrow">
                        <button
                          type="button"
                          className="heatmap-nav"
                          title="Earlier"
                          aria-label="Earlier"
                          disabled={!grid.canEarlier}
                          onClick={() => setWeekOffset((o) => o + 8)}
                        >
                          <ChevronLeftIcon size={14} />
                        </button>
                        <div className="heatmap-months">
                          {grid.monthSections.map((sec, i) => (
                            <span
                              key={i}
                              style={{
                                width: `${sec.span * HEATMAP_CELL + (sec.span - 1) * HEATMAP_GAP}px`,
                                textAlign: 'center'
                              }}
                            >
                              {sec.label}
                            </span>
                          ))}
                        </div>
                        <span className="heatmap-year">{grid.gridYear}</span>
                        <button
                          type="button"
                          className="heatmap-nav"
                          title="Later"
                          aria-label="Later"
                          disabled={weekOffset === 0}
                          onClick={() => setWeekOffset((o) => Math.max(0, o - 8))}
                        >
                          <ChevronRightIcon size={14} />
                        </button>
                      </div>
                      <div className="heatmap-body">
                        <div className="heatmap-days">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                            <span key={d}>{d}</span>
                          ))}
                        </div>
                        <div className="heatmap">
                          {grid.weeks.map((col, wi) => (
                            <div className="heatmap-col" key={wi}>
                              {col.map((cell, di) =>
                                cell === null ? (
                                  <span className="heatmap-cell empty" key={di} />
                                ) : (
                                  <span
                                    className="heatmap-cell"
                                    data-level={grid.level(cell.words)}
                                    key={di}
                                    title={`${cell.date.toLocaleDateString()}: ${cell.words} words`}
                                  />
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="heatmap-legend">
                        <span>More</span>
                        {[4, 3, 2, 1].map((l) => (
                          <span className="heatmap-cell" data-level={l} key={l} />
                        ))}
                        <span>Less</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="insights-grid">
                  <div className="insights-card">
                    <p className="insights-card-value">{insights.correctionsVocab}</p>
                    <p className="insights-card-kicker">vocabulary fixes</p>
                    <p className="insights-card-note" style={{ marginTop: 12 }}>
                      Times your own dictionary replaced a phrase you said with the way you write it.
                    </p>
                  </div>
                  <div className="insights-card">
                    <p className="insights-card-value">{insights.correctionsFillers}</p>
                    <p className="insights-card-kicker">filler words removed</p>
                    <p className="insights-card-note" style={{ marginTop: 12 }}>
                      Um, uh, er, ah and hmm, stripped out of your dictations.
                    </p>
                  </div>
                  <div className="insights-card">
                    <p className="insights-card-value">{insights.perDay.length}</p>
                    <p className="insights-card-kicker">days you dictated</p>
                    <p className="insights-card-note" style={{ marginTop: 12 }}>
                      {insights.longestStreak} day{insights.longestStreak === 1 ? '' : 's'} is your best run.
                    </p>
                  </div>
                </div>

                <div className="insights-card insights-card-wide">
                  <h2 className="insights-card-title">Top words</h2>
                  {insights.topWords.length === 0 ? (
                    <p className="page-empty-flat" style={{ padding: '24px 0' }}>
                      Dictate more to see your top words.
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      {insights.topWords.map((w) => (
                        <div className="toprow" key={w.word}>
                          <span className="toprow-label">{w.word}</span>
                          <div className="toprow-track">
                            <div className="toprow-fill" style={{ width: `${Math.round((w.count / maxWord) * 100)}%` }} />
                          </div>
                          <span className="toprow-count">{w.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="insights-card insights-card-wide">
                  <h2 className="insights-card-title">Repeated phrases</h2>
                  {insights.topPhrases.length === 0 ? (
                    <p className="page-empty-flat" style={{ padding: '24px 0' }}>
                      No repeated phrases yet.
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      {insights.topPhrases.map((p) => (
                        <div className="toprow" key={p.phrase}>
                          <span className="toprow-label wide">&ldquo;{p.phrase}&rdquo;</span>
                          <span className="toprow-count">x{p.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
