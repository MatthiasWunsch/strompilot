import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, Cell,
} from 'recharts'

const eur = (n) => n == null ? '—' : n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
const ct = (n) => n == null ? '—' : n.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ct'
const kwh = (n) => n == null ? '—' : n.toLocaleString('de-AT', { maximumFractionDigits: 0 }) + ' kWh'

export default function ResultsView({ result, rangeLabel, meta, onReset }) {
  const { months, totals, coverage, surcharge } = result

  const comparable = months.filter((m) => m.fixedCost != null)
  const dynamicCheaper = totals.savings > 0

  const chartData = useMemo(
    () => comparable.map((m) => ({
      name: m.labelShort,
      Fix: round2(m.fixedCost),
      Dynamisch: round2(m.dynamicCost),
      savings: round2(m.savings),
    })),
    [comparable]
  )

  const pct = totals.fixedCost > 0
    ? (totals.savings / totals.fixedCost) * 100
    : null

  return (
    <section className="results">
      <div className="results-head">
        <div>
          <p className="kicker">Ergebnis · {rangeLabel}</p>
          <h2>
            {comparable.length === 0
              ? 'Keine Monate zum Vergleichen'
              : dynamicCheaper
                ? <>Dynamisch wäre <em className="pos">günstiger</em> gewesen</>
                : <>Dein Fixtarif war <em className="neg">günstiger</em></>}
          </h2>
        </div>
        <button className="btn btn-ghost" onClick={onReset}>Neu starten</button>
      </div>

      {comparable.length > 0 && (
        <div className="headline-cards">
          <div className={'hcard hcard-hero ' + (dynamicCheaper ? 'is-pos' : 'is-neg')}>
            <span className="hcard-label">{dynamicCheaper ? 'Mögliche Ersparnis' : 'Mehrkosten dynamisch'}</span>
            <span className="hcard-value">{eur(Math.abs(totals.savings))}</span>
            <span className="hcard-sub">
              {pct != null && <>{dynamicCheaper ? '−' : '+'}{Math.abs(pct).toFixed(1)} % über {comparable.length} {comparable.length === 1 ? 'Monat' : 'Monate'}</>}
            </span>
          </div>
          <div className="hcard">
            <span className="hcard-label">Fixtarif gesamt</span>
            <span className="hcard-value">{eur(totals.fixedCost)}</span>
            <span className="hcard-sub">verglichener Zeitraum</span>
          </div>
          <div className="hcard">
            <span className="hcard-label">Dynamisch gesamt</span>
            <span className="hcard-value">{eur(totals.dynamicCostWhereFixed)}</span>
            <span className="hcard-sub">Spot + {ct(surcharge)} /kWh</span>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="chart-card">
          <div className="chart-head">
            <h3>Monatliche Kosten im Vergleich</h3>
            <div className="legend-inline">
              <span><i className="sw sw-fix" />Fix</span>
              <span><i className="sw sw-dyn" />Dynamisch</span>
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'Space Mono' }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${v}€`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="Fix" radius={[3, 3, 0, 0]} fill="#6b7280">
                  {chartData.map((e, i) => <Cell key={i} fill="#6b7280" />)}
                </Bar>
                <Bar dataKey="Dynamisch" radius={[3, 3, 0, 0]}>
                  {chartData.map((e, i) => (
                    <Cell key={i} fill={e.Dynamisch <= e.Fix ? '#d4ff4f' : '#ff7a59'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="table-card">
        <h3>Alle Monate im Detail</h3>
        <div className="table-scroll">
          <table className="months-table">
            <thead>
              <tr>
                <th>Monat</th>
                <th className="num">Verbrauch</th>
                <th className="num">Ø Spot netto</th>
                <th className="num">Ø Dynamisch</th>
                <th className="num">Dein Fix</th>
                <th className="num">Kosten Fix</th>
                <th className="num">Kosten Dyn.</th>
                <th className="num">Differenz</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.monthKey} className={m.fixedCost == null ? 'row-muted' : ''}>
                  <td className="mname">
                    {m.label}
                    {m.dynamicEstimated && <span className="flag" title="Teilweise hochgerechnet, da einzelne Stunden ohne Spotpreis">~</span>}
                  </td>
                  <td className="num">{kwh(m.kwh)}</td>
                  <td className="num dim">{ct(m.avgSpotNetCt)}</td>
                  <td className="num">{ct(m.avgDynGrossCt)}</td>
                  <td className="num">{m.fixedRate != null ? ct(m.fixedRate) : '—'}</td>
                  <td className="num">{eur(m.fixedCost)}</td>
                  <td className="num">{eur(m.dynamicCost)}</td>
                  <td className={'num ' + (m.savings == null ? '' : m.savings > 0 ? 'pos' : 'neg')}>
                    {m.savings == null ? '—' : (m.savings > 0 ? '−' : '+') + eur(Math.abs(m.savings))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Summe (verglichen)</td>
                <td className="num">{kwh(comparable.reduce((s, m) => s + m.kwh, 0))}</td>
                <td className="num"></td>
                <td className="num"></td>
                <td className="num"></td>
                <td className="num">{eur(totals.fixedCost)}</td>
                <td className="num">{eur(totals.dynamicCostWhereFixed)}</td>
                <td className={'num ' + (totals.savings > 0 ? 'pos' : 'neg')}>
                  {(totals.savings > 0 ? '−' : '+') + eur(Math.abs(totals.savings))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="table-note">
          „Differenz" mit <span className="pos">−</span> = dynamisch hätte weniger gekostet,
          <span className="neg"> +</span> = mehr. Graue Zeilen ohne eingegebenen Fixpreis fließen nicht in die Summe ein.
          {coverage.missingHours > 0 && (
            <> {' '}Für {coverage.missingHours.toLocaleString('de-AT')} von {coverage.totalHours.toLocaleString('de-AT')} Stunden lag kein Spotpreis vor (mit <span className="flag">~</span> markierte Monate wurden anteilig hochgerechnet).</>
          )}
        </p>
      </div>
    </section>
  )
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const fix = payload.find((p) => p.dataKey === 'Fix')?.value
  const dyn = payload.find((p) => p.dataKey === 'Dynamisch')?.value
  const diff = fix != null && dyn != null ? fix - dyn : null
  return (
    <div className="chart-tip">
      <div className="tip-month">{label}</div>
      <div className="tip-row"><span>Fix</span><b>{eur(fix)}</b></div>
      <div className="tip-row"><span>Dynamisch</span><b>{eur(dyn)}</b></div>
      {diff != null && (
        <div className={'tip-diff ' + (diff > 0 ? 'pos' : 'neg')}>
          {diff > 0 ? 'spart ' : 'kostet '}{eur(Math.abs(diff))}
        </div>
      )}
    </div>
  )
}
