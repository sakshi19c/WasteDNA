import { useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { DemoBadge, ErrorState, Gauge, LiveBadge, ModeToggle, Skeleton } from '../components/ui'
import { assumptionText, errorText, interventionText, placeName, useT } from '../lib/i18n'

// Labels and hints come from the translation table (t.impact.metrics).
const METRICS = {
  segregation: { key: 'segregation_score', scale: 1, goodWhen: 'up', suffix: '' },
  contamination: { key: 'contamination', scale: 100, goodWhen: 'down', suffix: '%' },
  recovery: { key: 'recovery_score', scale: 1, goodWhen: 'up', suffix: '' },
}

export default function TrackImpact({ mode, onMode, version }) {
  const { t, lang } = useT()
  const locations = useAsync(() => api.locations(), [])
  const [picked, setPicked] = useState(null)

  const list = locations.data?.locations ?? []
  const activeId = picked ?? (list.find((l) => l.has_intervention) ?? list[0])?.id

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t.impact.title}</h1>
        <p className="lede">{t.impact.lede}</p>
        {mode === 'live' ? <LiveBadge /> : <DemoBadge />}
        <ModeToggle mode={mode} onChange={onMode} />
      </div>

      {locations.loading && <Skeleton lines={2} />}
      {locations.error && <ErrorState title={t.impact.locErr} message={errorText(lang, locations.error)} onRetry={locations.retry} />}

      {list.length > 0 && (
        <div className="picker" role="group" aria-label={t.impact.choose}>
          {list.map((l) => (
            <button key={l.id} aria-pressed={l.id === activeId} onClick={() => setPicked(l.id)}>
              {placeName(lang, l.name)}
              {l.has_intervention && <span className="dot" title={t.impact.hasInt} />}
            </button>
          ))}
        </div>
      )}

      {activeId && <ImpactView id={activeId} mode={mode} version={version} />}
    </div>
  )
}

function ChartTip({ active, payload, label, metric }) {
  const { t } = useT()
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      <b>{t.impact.week(label)}</b>
      <span>{metric.label}: {Math.round(payload[0].value)}{metric.suffix}</span>
    </div>
  )
}

function ImpactView({ id, mode, version }) {
  const { t, lang } = useT()
  const { data, loading, error, retry } = useAsync(() => api.impact(id, mode), [id, mode, version])
  const [metricId, setMetricId] = useState('segregation')

  if (loading) return <Skeleton lines={5} />
  if (error) return <ErrorState title={t.impact.impErr} message={errorText(lang, error)} onRetry={retry} />

  if (data.observations.length === 0) {
    return (
      <div className="notice notice-info" role="status">
        <div>
          <strong>{t.impact.noneTitle(mode === 'live', placeName(lang, data.location.name))}</strong>
          <p>{mode === 'live' ? t.impact.noneLive : t.impact.noneDemo}</p>
          {mode === 'live' && <a className="btn btn-quiet" href="#/scan">{t.impact.goScan}</a>}
        </div>
      </div>
    )
  }

  const metric = { ...METRICS[metricId], ...t.impact.metrics[metricId] }
  const points = data.observations.map((o) => ({ week: o.week, value: Number(o[metric.key]) * metric.scale }))
  const intervention = data.interventions[0]
  const latest = points[points.length - 1]

  // Compare "before" (week before the intervention, else week 1) with the latest week.
  const before = intervention
    ? [...points].reverse().find((p) => p.week < intervention.start_week) ?? points[0]
    : points[0]
  const change = latest && before ? latest.value - before.value : 0
  const improved = metric.goodWhen === 'up' ? change > 0 : change < 0
  const flat = Math.abs(change) < 2

  const sentence = points.length < 2
    ? t.impact.oneWeek(latest.week)
    : flat
    ? t.impact.steady(metric.label, before.week)
    : t.impact.changed(metric.label, change > 0, Math.round(before.value), Math.round(latest.value), metric.suffix, before.week, Boolean(intervention), improved)

  const gain = data.projectedGain

  return (
    <>
      <section className="block" aria-labelledby="trend-title">
        <div className="block-head">
          <div>
            <h2 id="trend-title">{placeName(lang, data.location.name)}</h2>
            <p className="muted">{metric.hint}</p>
          </div>
          <div className="seg" role="group" aria-label={t.impact.metricGroup}>
            {Object.keys(METRICS).map((key) => (
              <button key={key} aria-pressed={metricId === key} onClick={() => setMetricId(key)}>{t.impact.metrics[key].label}</button>
            ))}
          </div>
        </div>

        <p className={`finding verdict-line ${flat ? '' : improved ? 'is-good' : 'is-bad'}`}>{sentence}</p>

        <div className="chart" role="img"
          aria-label={t.impact.chartLabel(metric.label, points.map((p) => t.impact.chartPoint(p.week, Math.round(p.value))).join(', '))}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={points} margin={{ top: 24, right: 20, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="week" tickFormatter={(w) => t.impact.wk(w)} stroke="var(--muted)" tickLine={false} />
              <YAxis domain={[0, 100]} stroke="var(--muted)" tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip metric={metric} />} />
              {intervention && (
                <ReferenceLine x={intervention.start_week} stroke="var(--green)" strokeWidth={2} strokeDasharray="5 4"
                  label={{ value: t.impact.starts, position: 'insideTopRight', fill: 'var(--green)', fontSize: 13 }} />
              )}
              <Area type="monotone" dataKey="value" stroke="var(--blue)" strokeWidth={3}
                fill="var(--blue)" fillOpacity={0.12} dot={{ r: 4, fill: 'var(--blue)', strokeWidth: 0 }}
                activeDot={{ r: 6 }} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="two-up">
        <section className="panel" aria-labelledby="int-title">
          <h3 id="int-title">{t.impact.intTitle}</h3>
          {data.interventions.length === 0 ? (
            <p className="muted">{t.impact.noInt}</p>
          ) : (
            <ol className="timeline">
              {data.interventions.map((i) => (
                <li key={i.start_week}>
                  <b>{t.impact.week(i.start_week)}</b>
                  <p lang={lang}>{interventionText(lang, i.description)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {gain && (
          <section className="panel" aria-labelledby="proj-title">
            <h3 id="proj-title">{t.impact.halfTitle}</h3>
            <div className="proj">
              <div><Gauge value={gain.currentScore} size={120} label={t.impact.nowScore} /><span>{t.impact.now}</span></div>
              <div><Gauge value={gain.projectedScore} size={120} label={t.impact.projScore} /><span>{t.impact.projected}</span></div>
            </div>
            <p className="finding">{t.impact.gainPre} <strong>{Math.round(gain.gain)} {t.impact.points}</strong>{t.impact.gainPost}</p>
            <p className="muted small">{assumptionText(lang, gain.assumption)}</p>
          </section>
        )}
      </div>
    </>
  )
}
