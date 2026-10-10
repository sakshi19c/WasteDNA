import { useEffect, useState } from 'react'
import { materialInfo, tone } from '../lib/format'
import { useT } from '../lib/i18n'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- icons ---------- */
const Icon = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
export const ScanIcon = (p) => (
  <Icon {...p}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10" /></Icon>
)
export const LeakIcon = (p) => (
  <Icon {...p}><path d="M12 3c3.5 4.2 6 7 6 10.2A6 6 0 0 1 6 13.2C6 10 8.5 7.2 12 3z" /></Icon>
)
export const TrendIcon = (p) => (
  <Icon {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Icon>
)
export const SunIcon = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
)
export const MoonIcon = (p) => (
  <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Icon>
)
export const CameraIcon = (p) => (
  <Icon {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Icon>
)
export const ImageIcon = (p) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></Icon>
)
export const LeafIcon = (p) => (
  <Icon {...p}><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19c3-5 6-8 11-10" /></Icon>
)
export const AlertIcon = (p) => (
  <Icon {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></Icon>
)

/* ---------- brand ---------- */
export function Logo({ size = 30 }) {
  // Five rungs of different heights: the product's mark and its signature strand in miniature.
  const rungs = [['#2F6BFF', 12], ['#3FAE5A', 20], ['#D9A441', 26], ['#22C3C8', 20], ['#E85D9B', 12]]
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {rungs.map(([color, h], i) => (
        <rect key={i} x={3 + i * 5.6} y={16 - h / 2} width="3.6" height={h} rx="1.8" fill={color} />
      ))}
    </svg>
  )
}

/* ---------- numbers ---------- */
export function CountUp({ value, decimals = 0, duration = 1000 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf
    let start
    const tick = (t) => {
      start ??= t
      const p = reducedMotion() ? 1 : Math.min(1, (t - start) / duration)
      setN(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{n.toFixed(decimals)}</>
}

/* 270-degree gauge. Colour follows the grade band, so colour is never the only
   signal: the number and (when given) the grade letter are always printed. */
export function Gauge({ value, grade, size = 220, label }) {
  const { t } = useT()
  const name = label ?? t.gauge.label
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])

  const stroke = size * 0.075
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const arc = c * 0.75

  return (
    <div className={`gauge tone-${tone(value)}`} style={{ width: size, height: size }}
      role="img" aria-label={`${name}: ${Math.round(value)} ${t.gauge.outOf}${grade ? `, ${t.gauge.grade} ${grade}` : ''}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(135 ${size / 2} ${size / 2})`} fill="none" strokeLinecap="round" strokeWidth={stroke}>
          <circle className="gauge-track" cx={size / 2} cy={size / 2} r={r} strokeDasharray={`${arc} ${c}`} />
          <circle className="gauge-fill" cx={size / 2} cy={size / 2} r={r}
            strokeDasharray={`${(arc * Math.max(shown, 0.5)) / 100} ${c}`} />
        </g>
      </svg>
      <div className="gauge-center">
        <span className="gauge-value" style={{ fontSize: size * 0.3 }}><CountUp value={value} /></span>
        {grade && <span className="gauge-grade">{t.gauge.grade} {grade}</span>}
      </div>
    </div>
  )
}

/* ---------- the signature element: a waste "DNA strand" ----------
   Each rung is one slice of the material mix, so a bin's composition reads at
   a glance like a barcode. With no materials it idles as a neutral strand. */
export function DnaStrand({ materials, highlight = null, rungs = 48, label }) {
  const { t } = useT()
  const idle = !materials?.length
  let list = []

  if (!idle) {
    const total = materials.reduce((s, m) => s + m.share_pct, 0) || 1
    const bounds = []
    let acc = 0
    for (const m of materials) {
      acc += m.share_pct / total
      bounds.push(acc)
    }
    list = Array.from({ length: rungs }, (_, i) => {
      const p = (i + 0.5) / rungs
      const idx = bounds.findIndex((b) => p <= b + 1e-9)
      return materials[idx === -1 ? materials.length - 1 : idx]
    })
  }

  const count = idle ? rungs : list.length
  return (
    <div className={`strand${idle ? ' idle' : ''}`} role="img"
      aria-label={label ?? (idle ? '' : `${t.mix}: ` + materials.map((m) => `${t.materials[m.type] ?? m.type} ${Math.round(m.share_pct)}%`).join(', '))}
      aria-hidden={idle ? 'true' : undefined}>
      {Array.from({ length: count }, (_, i) => {
        const m = idle ? null : list[i]
        const height = 30 + 70 * Math.abs(Math.sin(i * 0.42))
        const dim = highlight && m && m.type !== highlight
        return (
          <span key={i} className={`rung${dim ? ' dim' : ''}`}
            style={{ '--h': `${height}%`, '--i': i, '--c': m ? materialInfo(m.type).color : undefined }} />
        )
      })}
    </div>
  )
}

/* ---------- small pieces ---------- */
export function Meter({ value, level, label }) {
  return (
    <div className={`meter level-${level}`} role="meter" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(value)} aria-label={label}>
      <span style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

export function LevelText({ level }) {
  const { t } = useT()
  return <span className={`level-text level-${level}`}>{t.severity[level]}</span>
}

export const Chip = ({ children, kind = 'neutral' }) => <span className={`chip chip-${kind}`}>{children}</span>

export function DemoBadge() {
  const { t } = useT()
  return <span className="chip chip-demo" title={t.ui.demoTip}>{t.ui.demo}</span>
}

export function LiveBadge() {
  const { t } = useT()
  return <span className="chip chip-live" title={t.ui.liveTip}>{t.ui.live}</span>
}

/* Switches the dashboards between the seeded demo data and real logged scans. */
export function ModeToggle({ mode, onChange }) {
  const { t } = useT()
  return (
    <div className="seg mode-seg" role="group" aria-label={t.ui.source}>
      <button aria-pressed={mode === 'demo'} onClick={() => onChange('demo')}>{t.ui.demo}</button>
      <button aria-pressed={mode === 'live'} onClick={() => onChange('live')}>{t.ui.live}</button>
    </div>
  )
}

export function EmptyLive({ children }) {
  const { t } = useT()
  return (
    <div className="notice notice-info" role="status">
      <div>
        <strong>{t.ui.emptyTitle}</strong>
        <p>{children ?? t.ui.emptyBody}</p>
        <a className="btn btn-quiet" href="#/scan">{t.ui.goScan}</a>
      </div>
    </div>
  )
}

export function Skeleton({ lines = 3 }) {
  const { t } = useT()
  return (
    <div className="skeleton" role="status" aria-label={t.ui.loading}>
      {Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${95 - i * 12}%` }} />)}
    </div>
  )
}

export function ErrorState({ title, message, onRetry }) {
  const { t } = useT()
  return (
    <div className="notice notice-error" role="alert">
      <AlertIcon />
      <div>
        <strong>{title ?? t.ui.errDefault}</strong>
        <p>{message}</p>
        {onRetry && <button className="btn btn-quiet" onClick={onRetry}>{t.ui.retry}</button>}
      </div>
    </div>
  )
}
