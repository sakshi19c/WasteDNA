import { useCallback, useEffect, useRef, useState } from 'react'
import { accessCode, api } from '../lib/api'
import { isoWeek, materialInfo, severity } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { T, errorText, placeName } from '../lib/i18n'
import {
  AlertIcon, CameraIcon, Chip, DnaStrand, ErrorState, Gauge, ImageIcon, LeafIcon, LevelText, Meter,
} from '../components/ui'

const LOOP_LINKS = ['#/scan', '#/scan', '#/leaks', '#/scan', '#/progress']
const MAX_BYTES = 10 * 1024 * 1024

export default function Analyze({ lang, onLogged, onViewLive }) {
  const t = T[lang]
  const STEPS = t.scan.steps
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | scanning | done
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [step, setStep] = useState(0)
  const [dragging, setDragging] = useState(false)
  // Optional: save this scan to a ward and week so it shows up in the live dashboards.
  const wards = useAsync(() => api.locations(), [])
  const [logTo, setLogTo] = useState('')
  const [week, setWeek] = useState(isoWeek)
  const [loggedTo, setLoggedTo] = useState(null)
  const [needsCode, setNeedsCode] = useState(false)
  const [codeInput, setCodeInput] = useState('')

  const pickRef = useRef(null)
  const cameraRef = useRef(null)
  const urlRef = useRef(null)
  const resultRef = useRef(null)

  const choose = useCallback((picked) => {
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      setError({ message: t.scan.notPhoto })
      return
    }
    if (picked.size > MAX_BYTES) {
      setError({ message: t.scan.tooBig })
      return
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(picked)
    setFile(picked)
    setPreview(urlRef.current)
    setResult(null)
    setError(null)
    setPhase('idle')
  }, [t])

  // Paste a screenshot or copied photo straight into the page.
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      if (item) choose(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [choose])

  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), [])

  // Rotate the status line while the server works.
  useEffect(() => {
    if (phase !== 'scanning') return
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1800)
    return () => clearInterval(id)
  }, [phase, STEPS.length])

  useEffect(() => {
    if (phase === 'done') {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      resultRef.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
    }
  }, [phase])

  async function run() {
    if (!file || phase === 'scanning') return
    setPhase('scanning')
    setStep(0)
    setError(null)
    try {
      const log = logTo && week > 0 ? { locationId: Number(logTo), week: Number(week) } : null
      const response = await api.analyze(file, log)
      setResult(response)
      setLoggedTo(response.savedObservation
        ? { ward: wards.data?.locations.find((w) => w.id === log.locationId)?.name ?? null, week: log.week }
        : null)
      if (response.savedObservation) onLogged?.()
      setPhase('done')
    } catch (e) {
      setNeedsCode(e.code === 'access_required')
      setError({ code: e.code, message: e.message })
      setPhase('idle')
    }
  }

  async function useSample() {
    try {
      const blob = await (await fetch('/sample-bin.webp')).blob()
      choose(new File([blob], 'sample-bin.webp', { type: blob.type || 'image/webp' }))
    } catch {
      setError({ message: t.scan.sampleFail })
    }
  }

  function reset() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setPhase('idle')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scanning = phase === 'scanning'

  return (
    <div className="page">
      <section className="hero" aria-labelledby="scan-title">
        <div className="hero-copy">
          <p className="theme-tag"><LeafIcon size={16} />{t.theme.tag}</p>
          <h1 id="scan-title">{t.scan.title}</h1>
          <p className="lede">{t.scan.lede}</p>
          <ul className="hero-points">
            {t.scan.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>

        <div className="capture">
          <div
            className={`drop${dragging ? ' is-drag' : ''}${preview ? ' has-photo' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]) }}
          >
            {preview ? (
              <div className={`photo${scanning ? ' scanning' : ''}`}>
                <img src={preview} alt={t.scan.photoAlt} />
                {scanning && <div className="scanline" aria-hidden="true" />}
              </div>
            ) : (
              <div className="drop-empty">
                <DnaStrand />
                <p className="drop-title">{t.scan.dropTitle}</p>
                <p className="muted">{t.scan.dropSub}</p>
              </div>
            )}
          </div>

          <div className="capture-actions">
            <button className="btn btn-primary" onClick={run} disabled={!file || scanning}>
              {scanning ? t.scan.analyzing : t.scan.analyze}
            </button>
            <button className="btn" onClick={() => pickRef.current.click()} disabled={scanning}>
              <ImageIcon size={18} /> {preview ? t.scan.change : t.scan.choose}
            </button>
            <button className="btn btn-camera" onClick={() => cameraRef.current.click()} disabled={scanning}>
              <CameraIcon size={18} /> {t.scan.take}
            </button>
            {!preview && <button className="btn btn-quiet" onClick={useSample}>{t.scan.sample}</button>}
          </div>

          <input ref={pickRef} type="file" accept="image/*" hidden
            onChange={(e) => { choose(e.target.files[0]); e.target.value = '' }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => { choose(e.target.files[0]); e.target.value = '' }} />

          <div className="logbox">
            <label>
              <span>{t.scan.logTo} <small>{t.scan.optional}</small></span>
              <select value={logTo} onChange={(e) => setLogTo(e.target.value)} disabled={scanning}>
                <option value="">{t.scan.noLog}</option>
                {(wards.data?.locations ?? []).map((w) => (
                  <option key={w.id} value={w.id}>{placeName(lang, w.name)}</option>
                ))}
              </select>
            </label>
            {logTo && (
              <label className="logbox-week">
                <span>{t.scan.week}</span>
                <input type="number" min="1" max="53" value={week} disabled={scanning}
                  onChange={(e) => setWeek(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
            )}
            {logTo && <p className="muted small">{t.scan.logHint}</p>}
          </div>

          <p className="status" role="status" aria-live="polite">
            {scanning ? `${STEPS[step]}…` : ''}
          </p>

          {needsCode && (
            <form className="logbox codebox" onSubmit={(e) => {
              e.preventDefault()
              accessCode.set(codeInput.trim())
              setNeedsCode(false)
              run()
            }}>
              <label><span>{t.scan.accessCode}</span>
                <input type="password" value={codeInput} autoComplete="off"
                  onChange={(e) => setCodeInput(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={!codeInput.trim()}>{t.scan.saveScan}</button>
            </form>
          )}

          {error && (
            <ErrorState
              title={t.scan.errTitle}
              message={error.code ? errorText(lang, error) : error.message}
              onRetry={file && !scanning ? run : undefined}
            />
          )}
        </div>
      </section>

      <aside className="theme-band" aria-label={t.theme.loopTitle}>
        <p className="theme-stat"><strong>{t.theme.statNum}</strong> {t.theme.statText}</p>
        <h2 className="loop-title">{t.theme.loopTitle}</h2>
        <ol className="loop">
          {t.theme.steps.map((step, i) => (
            <li key={step.n}>
              <a href={LOOP_LINKS[i]}>
                <span className="loop-n" aria-hidden="true">{i + 1}</span>
                <strong>{step.n}</strong>
                <small>{step.d}</small>
              </a>
            </li>
          ))}
        </ol>
      </aside>

      {result && phase === 'done' && (
        <Results result={result} resultRef={resultRef} onReset={reset} lang={lang}
          loggedTo={loggedTo} onViewLive={onViewLive} />
      )}
    </div>
  )
}

function Results({ result, resultRef, onReset, lang, loggedTo, onViewLive }) {
  const { analysis, recovery, projections, routing = [], privacy } = result
  const t = T[lang]
  const diagnosis = lang === 'hi' && result.diagnosis_hi ? result.diagnosis_hi : result.diagnosis
  const recommendation = lang === 'hi' && result.recommendation_hi ? result.recommendation_hi : result.recommendation
  const range = recovery.range
  const [what, setWhat] = useState(2)
  const [hover, setHover] = useState(null)
  const [copied, setCopied] = useState(false)

  const materials = [...analysis.materials].sort((a, b) => b.share_pct - a.share_pct)
  const contaminationPct = Math.round(analysis.contamination.score * 100)
  const level = severity(contaminationPct)
  const confidence = Math.round(analysis.confidence * 100)
  const stream = t.streams[analysis.expected_stream]
  const limitations = lang === 'hi' && analysis.limitations_hi ? analysis.limitations_hi : analysis.limitations
  const matLabel = (type) => t.materials[type] ?? materialInfo(type).label
  const scenario = projections[what]

  async function copySummary() {
    const mix = materials.map((m) => `${matLabel(m.type)} ${Math.round(m.share_pct)}%`).join(', ')
    const text = t.scan.summary(recovery.score, recovery.grade, contaminationPct, mix, diagnosis, recommendation)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t.scan.copyPrompt, text)
    }
  }

  return (
    <section className="results" ref={resultRef} aria-labelledby="result-title">
      <h2 id="result-title">{t.result}</h2>

      {loggedTo && (
        <div className="notice notice-ok" role="status">
          <div>
            <strong>{t.scan.loggedTitle(loggedTo.ward ? placeName(lang, loggedTo.ward) : t.scan.defaultWard, loggedTo.week)}</strong>
            <p>{t.scan.loggedBody}</p>
            <button className="btn btn-quiet" onClick={onViewLive}>{t.scan.seeLeaks}</button>
          </div>
        </div>
      )}

      <div className="verdict">
        <div className="panel score-panel">
          <Gauge value={recovery.score} grade={recovery.grade} />
          <p className="grade-note">{t.grade[recovery.grade]}</p>
          {range && range.spread > 0 && (
            <p className="range" title={t.rangeNote}>
              {t.range}: <strong>{Math.round(range.low)}–{Math.round(range.high)}</strong>
            </p>
          )}
          <p className="muted small">{t.recoveryNote}</p>
        </div>

        <div className="panel mix-panel">
          <h3>{t.mix}</h3>
          <DnaStrand materials={materials} highlight={hover} />
          <ul className="mix-list">
            {materials.map((m, i) => {
              const info = materialInfo(m.type)
              return (
                <li key={i} tabIndex={0}
                  onMouseEnter={() => setHover(m.type)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(m.type)} onBlur={() => setHover(null)}>
                  <span className="swatch" style={{ background: info.color }} aria-hidden="true" />
                  <span className="mix-name">
                    <strong>{matLabel(m.type)}</strong>
                    {(lang === 'hi' ? m.notes_hi || m.notes : m.notes) && <small lang={lang === 'hi' && m.notes_hi ? 'hi' : 'en'}>{lang === 'hi' ? m.notes_hi || m.notes : m.notes}</small>}
                  </span>
                  <span className="mix-pct">{Math.round(m.share_pct)}%</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>{t.scan.contamination}</dt>
          <dd>
            <span className="fact-big">{contaminationPct}%</span>
            <Meter value={contaminationPct} level={level} label={t.scan.contamination} />
            <span><LevelText level={level} /> {t.scan.level}
              {analysis.contamination.sources.length > 0 && <>, {t.scan.mainlyFrom} {analysis.contamination.sources.map((x) => t.sourceWords?.[x] ?? x).join(` ${t.scan.and} `)}</>}
            </span>
          </dd>
        </div>
        <div>
          <dt>{t.scan.hazards}</dt>
          <dd>
            {analysis.hazard_flags.length === 0 ? (
              <span className="fact-big fact-ok">{t.scan.none}</span>
            ) : (
              <span className="chips">
                {analysis.hazard_flags.map((h) => (
                  <Chip key={h} kind="danger"><AlertIcon size={14} />{t.hazardNames[h]}</Chip>
                ))}
              </span>
            )}
            <span>{t.scan.hazardCost}</span>
          </dd>
        </div>
        <div>
          <dt>{t.scan.stream}</dt>
          <dd>
            <span className="fact-big">{stream.label}</span>
            <span>{stream.note}</span>
          </dd>
        </div>
        <div>
          <dt>{t.scan.confidence}</dt>
          <dd>
            <span className="fact-big">{confidence}%</span>
            <Meter value={confidence} level={confidence >= 70 ? 'low' : confidence >= 40 ? 'medium' : 'high'} label={t.scan.confidence} />
            {confidence < 50 && <span className="warn-text">{t.scan.lowConf}</span>}
          </dd>
        </div>
      </dl>

      <div className="findings">
        <div>
          <h3>{t.wrong}</h3>
          <p className="finding" lang={lang}>{diagnosis}</p>
        </div>
        <div>
          <h3>{t.first}</h3>
          <p className="finding" lang={lang}>{recommendation}</p>
        </div>
      </div>

      {routing.length > 0 && (
        <section className="panel routing" aria-labelledby="routing-title">
          <h3 id="routing-title">{t.routingTitle}</h3>
          <p className="muted small">{t.routingNote}</p>
          <ul className="bins">
            {routing.map((bin) => {
              const info = t.bins[bin.id]
              return (
                <li key={bin.id} className={`bin bin-${bin.id}`}>
                  <span className="bin-swatch" aria-hidden="true" />
                  <div>
                    <strong>{info.name}</strong>
                    <span className="bin-stream">{info.stream}</span>
                    <small>{info.tip}</small>
                    <span className="bin-items">
                      {bin.items.map((i) => t.hazardNames[i] ?? matLabel(i)).join(', ')}
                    </span>
                  </div>
                  {bin.share_pct !== null && <b className="bin-pct">{Math.round(bin.share_pct)}%</b>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {analysis.contamination.score > 0 && (
        <div className="panel whatif">
          <h3>{t.scan.whatifTitle}</h3>
          <label htmlFor="whatif" className="muted">{t.scan.whatifHelp}</label>
          <input id="whatif" type="range" min="0" max={projections.length - 1} step="1"
            value={what} onChange={(e) => setWhat(Number(e.target.value))} />
          <div className="ticks" aria-hidden="true">
            {projections.map((p) => <span key={p.reduction}>{Math.round(p.reduction * 100)}%</span>)}
          </div>
          <p className="whatif-out" aria-live="polite">
            {t.scan.whatifPre(Math.round(scenario.reduction * 100))}{' '}
            <strong>{Math.round(scenario.projectedScore)}</strong>{t.scan.whatifMid(scenario.grade)}
            {scenario.gain > 0 && <>{t.scan.whatifGainPre}<strong>{t.scan.whatifGain(Math.round(scenario.gain))}</strong></>}{t.scan.whatifEnd}
          </p>
        </div>
      )}

      <p className="muted small" lang={lang === 'hi' && analysis.limitations_hi ? 'hi' : 'en'}>{limitations}</p>
      {privacy?.metadataStripped && (
        <p className="muted small">{t.scan.privacy}</p>
      )}

      <div className="result-actions">
        <button className="btn btn-primary" onClick={copySummary}>{copied ? t.copied : t.copy}</button>
        <button className="btn" onClick={onReset}>{t.scanAnother}</button>
      </div>
    </section>
  )
}
