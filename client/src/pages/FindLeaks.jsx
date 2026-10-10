import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { DemoBadge, EmptyLive, ErrorState, Chip, LiveBadge, ModeToggle, Skeleton } from '../components/ui'
import { severity } from '../lib/format'
import { errorText, placeName, placeType, useT } from '../lib/i18n'

const SORT_IDS = ['lost', 'contamination', 'segregation']

export default function FindLeaks({ mode, onMode, version }) {
  const { t, lang } = useT()
  const { data, loading, error, retry } = useAsync(async () => {
    const [leaks, weekly, sources] = await Promise.all([api.leaks(mode), api.weekly(mode), api.sources(mode)])
    return { leaks: leaks.locations, weekly: weekly.weekly, sources: sources.sources }
  }, [mode, version])

  return (
    <div className="page">
      {loading && <div className="page-head"><h1>{t.leaks.title}</h1><Skeleton lines={4} /></div>}
      {error && <ErrorState title={t.leaks.errTitle} message={errorText(lang, error)} onRetry={retry} />}
      {data && data.leaks.length === 0 && (
        <div className="page-head">
          <h1>{t.leaks.title}</h1>
          <ModeToggle mode={mode} onChange={onMode} />
          <EmptyLive />
        </div>
      )}
      {data && data.leaks.length > 0 && <LeaksView {...data} mode={mode} onMode={onMode} />}
    </div>
  )
}

function Sparkline({ values: allValues, label }) {
  const w = 84
  const h = 26
  const values = allValues.filter((v) => v !== null)
  if (values.length < 2) return null
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * (w - 4) + 2},${h - 2 - (v / 100) * (h - 4)}`)
    .join(' ')
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function LeaksView({ leaks, weekly, sources, mode, onMode }) {
  const { t, lang } = useT()
  const [sort, setSort] = useState('lost')

  const { rows, weeks, headline } = useMemo(() => {
    const weeks = Object.keys(weekly).map(Number).sort((a, b) => a - b)
    const byWeek = {}
    const topCount = {}

    for (const w of weeks) {
      weekly[w].forEach((r, rank) => {
        ;(byWeek[r.location] ??= {})[w] = r.contamination
        if (rank < 3) topCount[r.location] = (topCount[r.location] ?? 0) + 1
      })
    }

    const rows = leaks.map((l) => {
      // One slot per week; null where this location had no scan that week.
      const s = weeks.map((w) => byWeek[l.location]?.[w] ?? null)
      const seen = s.filter((v) => v !== null)
      return {
        ...l,
        series: s,
        trend: seen.length > 1 ? seen[seen.length - 1] - seen[0] : 0,
        chronic: (topCount[l.location] ?? 0) >= Math.ceil(weeks.length * 0.75),
      }
    })

    return {
      rows,
      weeks,
      headline: {
        worst: leaks[0],
        worse: rows.filter((r) => r.trend >= 5).length,
        better: rows.filter((r) => r.trend <= -5).length,
        avg: rows.reduce((s, r) => s + r.avg_contamination, 0) / (rows.length || 1),
      },
    }
  }, [leaks, weekly])

  const sorted = useMemo(() => {
    const by = {
      lost: (a, b) => b.lost_recyclable_material - a.lost_recyclable_material,
      contamination: (a, b) => b.avg_contamination - a.avg_contamination,
      segregation: (a, b) => a.avg_segregation_score - b.avg_segregation_score,
    }[sort]
    return [...rows].sort(by)
  }, [rows, sort])

  const maxLost = Math.max(...rows.map((r) => r.lost_recyclable_material), 1)
  const food = sources.find((s) => s.source === 'Food waste')?.percentage ?? 0

  return (
    <>
      <div className="page-head">
        <h1>{headline.worst ? t.leaks.headline(placeName(lang, headline.worst.location)) : t.leaks.noData}</h1>
        <p className="lede">
          {t.leaks.lede(rows.length, weeks.length, Math.round(headline.avg), headline.worse, headline.better)}
        </p>
        {mode === 'live' ? <LiveBadge /> : <DemoBadge />}
        <ModeToggle mode={mode} onChange={onMode} />
      </div>

      <section aria-labelledby="rank-title" className="block">
        <div className="block-head">
          <div>
            <h2 id="rank-title">{t.leaks.rank}</h2>
            <p className="muted">{t.leaks.rankNote}</p>
          </div>
          <div className="seg" role="group" aria-label={t.leaks.sortBy}>
            {SORT_IDS.map((id) => (
              <button key={id} aria-pressed={sort === id} onClick={() => setSort(id)}>{t.leaks.sorts[id]}</button>
            ))}
          </div>
        </div>

        <ol className="rank">
          {sorted.map((r, i) => {
            const level = severity(r.avg_contamination)
            const delta = Math.round(r.trend)
            return (
              <li key={r.id}>
                <span className="rank-n">{i + 1}</span>
                <div className="rank-name">
                  <strong>{placeName(lang, r.location)}</strong>
                  <small>{placeType(lang, r.type)}</small>
                  {r.chronic && <Chip kind="danger">{t.leaks.hotspot}</Chip>}
                </div>
                <div className="rank-bar" title={t.leaks.lostTip(r.lost_recyclable_material)}>
                  <span className={`level-${level}`} style={{ width: `${(r.lost_recyclable_material / maxLost) * 100}%` }} />
                  <b>{r.lost_recyclable_material}%</b>
                </div>
                <div className="rank-stat stat-1">
                  <b>{Math.round(r.avg_contamination)}%</b>
                  <small>{t.leaks.contaminated}</small>
                </div>
                <div className="rank-stat stat-2">
                  <b>{Math.round(r.avg_segregation_score)}</b>
                  <small>{t.leaks.segregation}</small>
                </div>
                <div className={`rank-trend ${delta >= 5 ? 'worse' : delta <= -5 ? 'better' : 'flat'}`}>
                  <Sparkline values={r.series} label={t.leaks.spark(placeName(lang, r.location))} />
                  <small>{delta >= 5 ? t.leaks.up(delta) : delta <= -5 ? t.leaks.down(-delta) : t.leaks.steady}</small>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="heat-title" className="block">
        <h2 id="heat-title">{t.leaks.heatTitle}</h2>
        <p className="muted">{t.leaks.heatNote}</p>
        <div className="scroll-x">
          <table className="heat">
            <caption className="sr-only">{t.leaks.heatCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.leaks.location}</th>
                {weeks.map((w) => <th scope="col" key={w}>{t.leaks.wk(w)}</th>)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{placeName(lang, r.location)}</th>
                  {r.series.map((v, i) => (
                    v === null
                      ? <td key={i} className="no-data" aria-label={t.leaks.noScan}>–</td>
                      : <td key={i} style={{ '--v': v / 100 }} className={v >= 55 ? 'on-dark' : ''}>{Math.round(v)}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PilotEstimator rows={sorted} mode={mode} />

      <section aria-labelledby="src-title" className="block">
        <div className="block-head">
          <h2 id="src-title">{t.leaks.srcTitle}</h2>
          <Chip>{t.ui.estimate}</Chip>
        </div>
        <div className="stack" role="img"
          aria-label={sources.map((s) => `${t.leaks.srcNames[s.source] ?? s.source} ${s.percentage}%`).join(', ')}>
          {sources.map((s, i) => (
            <span key={s.source} className={`stack-${i}`} style={{ width: `${s.percentage}%` }}>
              {s.percentage >= 12 && `${t.leaks.srcNames[s.source] ?? s.source} ${Math.round(s.percentage)}%`}
            </span>
          ))}
        </div>
        <p className="finding">
          {food >= 50 ? t.leaks.srcHigh(Math.round(food)) : t.leaks.srcLow(Math.round(food))}
        </p>
      </section>
    </>
  )
}

/* A back-of-envelope sizing tool for a pilot. Every input is an assumption the
   user can change, and the result is labelled as an estimate, not a measurement. */
function PilotEstimator({ rows, mode }) {
  const { t, lang } = useT()
  const [picked, setPicked] = useState(null)
  const [households, setHouseholds] = useState(500)
  const [kgPerHome, setKgPerHome] = useState(1.5)
  const [price, setPrice] = useState(10)

  const ward = rows.find((r) => r.id === picked) ?? rows[0]
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0)

  const monthlyKg = num(households) * num(kgPerHome) * 30
  const lostKg = (monthlyKg * ward.lost_recyclable_material) / 100
  const recoveredKg = lostKg / 2 // halving contamination recovers half of what is lost
  const rupees = recoveredKg * num(price)

  const fmt = (n) => Math.round(n).toLocaleString('en-IN')

  return (
    <section aria-labelledby="pilot-title" className="block pilot">
      <div className="block-head">
        <div>
          <h2 id="pilot-title">{t.leaks.pilotTitle}</h2>
          <p className="muted">
            {t.leaks.pilotNote}
            {mode === 'demo' && t.leaks.pilotDemo}
          </p>
        </div>
        <Chip>{t.ui.estimate}</Chip>
      </div>

      <div className="pilot-inputs">
        <label><span>{t.leaks.location}</span>
          <select value={ward.id} onChange={(e) => setPicked(Number(e.target.value))}>
            {rows.map((r) => <option key={r.id} value={r.id}>{placeName(lang, r.location)}</option>)}
          </select>
        </label>
        <label><span>{t.leaks.households}</span>
          <input type="number" min="1" value={households} onChange={(e) => setHouseholds(e.target.value)} />
        </label>
        <label><span>{t.leaks.perHome}</span>
          <input type="number" min="0.1" step="0.1" value={kgPerHome} onChange={(e) => setKgPerHome(e.target.value)} />
        </label>
        <label><span>{t.leaks.scrap}</span>
          <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
      </div>

      <dl className="facts pilot-out">
        <div><dt>{t.leaks.perMonth}</dt><dd><span className="fact-big">{fmt(monthlyKg)} {t.leaks.kg}</span></dd></div>
        <div><dt>{t.leaks.lostMixing}</dt><dd><span className="fact-big">{fmt(lostKg)} {t.leaks.kg}</span><span>{t.leaks.ofWaste(ward.lost_recyclable_material, placeName(lang, ward.location))}</span></dd></div>
        <div><dt>{t.leaks.recovered}</dt><dd><span className="fact-big fact-ok">{fmt(recoveredKg)} {t.leaks.kg}</span><span>{t.leaks.aboutRupees(fmt(rupees))}</span></dd></div>
      </dl>
    </section>
  )
}
