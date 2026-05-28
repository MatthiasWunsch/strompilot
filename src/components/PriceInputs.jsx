import { useMemo } from 'react'
import { monthLabel } from '../calc'

export default function PriceInputs({
  months, rangeLabel, meta, fixedPrices, setFixedPrices,
  surcharge, setSurcharge, onBack, onCompute, busy,
}) {
  const filledCount = useMemo(
    () => months.filter((m) => {
      const v = fixedPrices[m]
      return v !== '' && v != null && !isNaN(parseFloat(String(v).replace(',', '.')))
    }).length,
    [months, fixedPrices]
  )

  const update = (m, v) => setFixedPrices((prev) => ({ ...prev, [m]: v }))

  const applyToAll = () => {
    const first = fixedPrices[months[0]]
    if (first === '' || first == null) return
    setFixedPrices(Object.fromEntries(months.map((m) => [m, first])))
  }

  return (
    <section className="inputs">
      <div className="inputs-head">
        <div>
          <h2>Was hast du bezahlt?</h2>
          <p className="muted">
            Zeitraum <strong>{rangeLabel}</strong> · {meta.count.toLocaleString('de-AT')} Messwerte ·
            {' '}{meta.totalKwh.toLocaleString('de-AT', { maximumFractionDigits: 0 })} kWh gesamt
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onBack} disabled={busy}>Andere Datei</button>
      </div>

      <div className="surcharge-card">
        <div className="surcharge-text">
          <h3>Aufschlag auf den Spotpreis</h3>
          <p className="muted">
            Was ein dynamischer Anbieter pro kWh aufschlägt (brutto). aWattar liegt z.&nbsp;B. bei rund 1,5&nbsp;ct/kWh.
            Gilt für alle Monate gleich.
          </p>
        </div>
        <div className="surcharge-field">
          <input
            type="text"
            inputMode="decimal"
            value={surcharge}
            onChange={(e) => setSurcharge(e.target.value)}
            disabled={busy}
            aria-label="Aufschlag in Cent pro Kilowattstunde"
          />
          <span className="unit">ct/kWh</span>
        </div>
      </div>

      <div className="fixed-card">
        <div className="fixed-head">
          <div>
            <h3>Dein Energiepreis pro Monat</h3>
            <p className="muted">
              Nur Energie inkl. USt — <strong>ohne</strong> Netzentgelte und Abgaben. In ct/kWh.
              Leere Monate werden nicht verglichen.
            </p>
          </div>
          <button className="btn btn-tiny" onClick={applyToAll} disabled={busy || !fixedPrices[months[0]]}>
            ↧ Auf alle übernehmen
          </button>
        </div>

        <div className="month-grid">
          {months.map((m) => (
            <label key={m} className="month-field">
              <span className="month-name">{monthLabel(m)}</span>
              <span className="month-input">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  value={fixedPrices[m]}
                  onChange={(e) => update(m, e.target.value)}
                  disabled={busy}
                />
                <span className="unit">ct</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="inputs-foot">
        <p className="muted">
          {filledCount} von {months.length} Monaten ausgefüllt
        </p>
        <button className="btn btn-primary" onClick={onCompute} disabled={busy || filledCount === 0}>
          {busy ? (<><span className="spinner spinner-sm" /> Spotpreise werden geladen…</>) : 'Vergleich berechnen →'}
        </button>
      </div>
    </section>
  )
}
