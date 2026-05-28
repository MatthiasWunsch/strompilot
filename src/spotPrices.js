// Fetches Austrian day-ahead spot market prices via a Netlify proxy function,
// which in turn calls the Fraunhofer ISE energy-charts API.
//
//   GET /.netlify/functions/spot-prices?bzn=AT&start=YYYY-MM-DD&end=YYYY-MM-DD
//
// The proxy exists because energy-charts.info restricts its CORS header to its
// own origin, so direct browser fetches are blocked.
//
// Prices are NET (no taxes, no grid fees) — exactly the spot energy price.

function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function fetchSpotPrices(start, end, { bzn = 'AT', signal } = {}) {
  const startPad = new Date(start.getTime() - 24 * 3600 * 1000)
  const endPad = new Date(end.getTime() + 24 * 3600 * 1000)

  const params = new URLSearchParams({
    bzn,
    start: isoDate(startPad),
    end: isoDate(endPad),
  })

  const res = await fetch(`/.netlify/functions/spot-prices?${params}`, { signal })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`Spotpreis-Abruf fehlgeschlagen (HTTP ${res.status}). ${msg}`.trim())
  }
  const data = await res.json()
  if (!data || !Array.isArray(data.unix_seconds) || !Array.isArray(data.price)) {
    throw new Error('Unerwartetes Antwortformat vom Spotpreis-Dienst.')
  }

  const byHour = new Map()
  const n = Math.min(data.unix_seconds.length, data.price.length)
  for (let i = 0; i < n; i++) {
    const p = data.price[i]
    if (p == null) continue
    byHour.set(data.unix_seconds[i], p)
  }

  return { unit: data.unit || 'EUR/MWh', byHour, rawCount: n }
}

export function spotEurPerKwh(byHour, hourStart) {
  const sec = Math.floor(hourStart.getTime() / 1000)
  let eurMwh = byHour.get(sec)
  if (eurMwh == null) {
    for (const delta of [3600, -3600]) {
      eurMwh = byHour.get(sec + delta)
      if (eurMwh != null) break
    }
  }
  if (eurMwh == null) return null
  return eurMwh / 1000
}
