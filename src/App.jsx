import { useState, useCallback, useMemo, useRef } from 'react'
import { parseConsumptionFile, aggregateHourly } from './parseConsumption'
import { fetchSpotPrices } from './spotPrices'
import { computeComparison, VAT } from './calc'
import UploadZone from './components/UploadZone'
import PriceInputs from './components/PriceInputs'
import ResultsView from './components/ResultsView'

const STEPS = {
  IDLE: 'idle',
  PARSING: 'parsing',
  INPUTS: 'inputs',
  FETCHING: 'fetching',
  RESULTS: 'results',
}

export default function App() {
  const [step, setStep] = useState(STEPS.IDLE)
  const [error, setError] = useState(null)
  const [parsed, setParsed] = useState(null) // { rows, meta }
  const [hourly, setHourly] = useState(null)
  const [months, setMonths] = useState([]) // distinct monthKeys
  const [fixedPrices, setFixedPrices] = useState({})
  const [surcharge, setSurcharge] = useState('1.50')
  const [result, setResult] = useState(null)
  const abortRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    setError(null)
    setStep(STEPS.PARSING)
    try {
      const buf = await file.arrayBuffer()
      const p = parseConsumptionFile(buf, file.name)
      const h = aggregateHourly(p.rows)
      const monthKeys = [...new Set(h.map((x) => x.monthKey))].sort()
      setParsed(p)
      setHourly(h)
      setMonths(monthKeys)
      setFixedPrices(Object.fromEntries(monthKeys.map((m) => [m, ''])))
      setStep(STEPS.INPUTS)
    } catch (e) {
      setError(e.message || 'Datei konnte nicht gelesen werden.')
      setStep(STEPS.IDLE)
    }
  }, [])

  const handleCompute = useCallback(async () => {
    setError(null)
    setStep(STEPS.FETCHING)
    try {
      const controller = new AbortController()
      abortRef.current = controller
      const { meta } = parsed
      const spot = await fetchSpotPrices(meta.start, meta.end, { signal: controller.signal })
      const surchargeNum = parseFloat(String(surcharge).replace(',', '.')) || 0
      const comp = computeComparison(hourly, spot.byHour, surchargeNum, fixedPrices)
      if (comp.coverage.matchedHours === 0) {
        throw new Error('Für den Zeitraum der Datei wurden keine Spotpreise gefunden. Liegt der Zeitraum evtl. in der Zukunft?')
      }
      setResult({ ...comp, spotUnit: spot.unit, surcharge: surchargeNum })
      setStep(STEPS.RESULTS)
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || 'Berechnung fehlgeschlagen.')
      setStep(STEPS.INPUTS)
    }
  }, [parsed, hourly, fixedPrices, surcharge])

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setStep(STEPS.IDLE)
    setError(null)
    setParsed(null)
    setHourly(null)
    setMonths([])
    setFixedPrices({})
    setResult(null)
  }, [])

  const rangeLabel = useMemo(() => {
    if (!parsed) return null
    const f = (d) => d.toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' })
    return `${f(parsed.meta.start)} – ${f(parsed.meta.end)}`
  }, [parsed])

  return (
    <div className="app">
      <Backdrop />
      <header className="masthead">
        <div className="brand">
          <span className="bolt" aria-hidden>⚡</span>
          <div>
            <h1>Strompilot</h1>
            <p className="kicker">Lohnt sich ein dynamischer Spotmarkt-Tarif?</p>
          </div>
        </div>
        <div className="masthead-meta">
          <span className="tag">Österreich</span>
          <span className="tag tag-muted">Spot · EXAA / Day-Ahead</span>
        </div>
      </header>

      <main className="stage">
        {step !== STEPS.RESULTS && (
          <section className="intro">
            <h2 className="lede">
              Lade deine <em>Viertelstundenwerte</em> hoch und sieh, was ein stündlich
              schwankender Tarif gekostet hätte — Stunde für Stunde gegen den echten Spotpreis gerechnet.
            </h2>
            <ol className="steps-rail">
              <li className={stepCls(step, [STEPS.IDLE, STEPS.PARSING])}><span>01</span>Datei laden</li>
              <li className={stepCls(step, [STEPS.INPUTS, STEPS.FETCHING])}><span>02</span>Preise eingeben</li>
              <li className={stepCls(step, [STEPS.RESULTS])}><span>03</span>Vergleich</li>
            </ol>
          </section>
        )}

        {error && (
          <div className="banner banner-error" role="alert">
            <strong>Hoppla.</strong> {error}
          </div>
        )}

        {(step === STEPS.IDLE || step === STEPS.PARSING) && (
          <UploadZone onFile={handleFile} busy={step === STEPS.PARSING} />
        )}

        {(step === STEPS.INPUTS || step === STEPS.FETCHING) && parsed && (
          <PriceInputs
            months={months}
            rangeLabel={rangeLabel}
            meta={parsed.meta}
            fixedPrices={fixedPrices}
            setFixedPrices={setFixedPrices}
            surcharge={surcharge}
            setSurcharge={setSurcharge}
            onBack={reset}
            onCompute={handleCompute}
            busy={step === STEPS.FETCHING}
          />
        )}

        {step === STEPS.RESULTS && result && (
          <ResultsView result={result} rangeLabel={rangeLabel} meta={parsed.meta} onReset={reset} />
        )}
      </main>

      <footer className="footer">
        <p>
          Spotpreise: <a href="https://www.energy-charts.info" target="_blank" rel="noreferrer">energy-charts.info</a> (Fraunhofer ISE, Day-Ahead AT, netto).
          USt {Math.round(VAT * 100)} % wird auf den Spotpreis aufgeschlagen. Netzentgelte, Abgaben &amp; Pauschalen sind <strong>nicht</strong> enthalten — auf beiden Seiten.
        </p>
        <p className="footer-fine">
          Keine Gewähr. Deine Daten bleiben im Browser und werden nicht hochgeladen oder gespeichert.
        </p>
      </footer>
    </div>
  )
}

function stepCls(step, active) {
  return 'rail-step' + (active.includes(step) ? ' is-active' : '')
}

function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="grid-lines" />
      <div className="glow glow-a" />
      <div className="glow glow-b" />
    </div>
  )
}
