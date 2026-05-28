// Fetches Austrian day-ahead spot market prices from the Fraunhofer ISE
// energy-charts API. The endpoint is CORS-enabled and needs no token.
//
//   GET https://api.energy-charts.info/price?bzn=AT&start=<ISO>&end=<ISO>
//
// Response shape:
//   {
//     "license_info": "...",
//     "unix_seconds": [1714514400, 1714518000, ...],  // hour start, UTC
//     "price": [12.34, 9.87, ...],                     // EUR/MWh
//     "unit": "EUR/MWh",
//     "deprecated": false
//   }
//
// Prices are NET (no taxes, no grid fees) — exactly the spot energy price.

const BASE = 'https://api.energy-charts.info/price'

function isoDate(d) {
  // energy-charts accepts YYYY-MM-DD (interpreted in the bidding zone tz)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Fetch prices covering [start, end]. We pad by one day on each side to be
// safe against timezone edges, then index by the hour's unix-second start.
export async function fetchSpotPrices(start, end, { bzn = 'AT', signal } = {}) {
  const startPad = new Date(start.getTime() - 24 * 3600 * 1000)
  const endPad = new Date(end.getTime() + 24 * 3600 * 1000)

  const url = `${BASE}?bzn=${encodeURIComponent(bzn)}&start=${isoDate(startPad)}&end=${isoDate(endPad)}`

  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`Spotpreis-Abruf fehlgeschlagen (HTTP ${res.status}). Bitte später erneut versuchen.`)
  }
  const data = await res.json()
  if (!data || !Array.isArray(data.unix_seconds) || !Array.isArray(data.price)) {
    throw new Error('Unerwartetes Antwortformat vom Spotpreis-Dienst.')
  }

  // Map: unix-second hour start -> price EUR/MWh
  const byHour = new Map()
  const n = Math.min(data.unix_seconds.length, data.price.length)
  for (let i = 0; i < n; i++) {
    const p = data.price[i]
    if (p == null) continue
    byHour.set(data.unix_seconds[i], p)
  }

  return {
    unit: data.unit || 'EUR/MWh',
    byHour,
    rawCount: n,
  }
}

// Look up the spot price (EUR/kWh, net) for a given hour-start Date.
export function spotEurPerKwh(byHour, hourStart) {
  const sec = Math.floor(hourStart.getTime() / 1000)
  let eurMwh = byHour.get(sec)
  if (eurMwh == null) {
    // Try the surrounding hour marks in case of rounding/offset drift.
    for (const delta of [3600, -3600]) {
      eurMwh = byHour.get(sec + delta)
      if (eurMwh != null) break
    }
  }
  if (eurMwh == null) return null
  return eurMwh / 1000 // EUR/MWh -> EUR/kWh
}
