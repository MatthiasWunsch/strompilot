import * as XLSX from 'xlsx'

// Parse an Austrian E-Control consumption export (CSV or XLSX).
//
// Expected CSV shape (semicolon-separated, comma decimals, BOM):
//   Ende Ablesezeitraum;Messintervall;Abrechnungsmaßeinheit;... [kWh];;
//   2025-05-01T00:15+02:00;QH;KWH;0,055;;
//
// The timestamp is the END of the interval. "QH" = quarter hour (15 min),
// the value is the kWh consumed during that interval.
//
// Returns { rows, meta } where rows is an array of
//   { ts: Date, hourKey: string, kwh: number }
// hourKey identifies the spot-price hour (interval START hour), e.g.
// "2025-05-01T00:00+02:00" — kept WITH offset so the duplicated hour on
// the DST fall-back night stays distinct.

const DECIMAL_COMMA = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+,\d+$|^-?\d+$/

function parseNumber(raw) {
  if (raw == null) return NaN
  const s = String(raw).trim()
  if (s === '') return NaN
  // Austrian export uses comma as decimal separator, no thousands separators
  // in practice for these small kWh values, but guard anyway.
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(s)
}

// "2025-05-01T00:15+02:00" -> { date, offset:"+02:00", localMinutes }
function parseTimestamp(raw) {
  const s = String(raw).trim()
  // Match ISO datetime with offset (+HH:MM / -HH:MM) or Z
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:?\d{2}|Z)?$/
  )
  if (!m) return null
  const [, y, mo, d, h, mi, se, off] = m
  const offset = !off || off === 'Z' ? '+00:00' : off.includes(':') ? off : `${off.slice(0, 3)}:${off.slice(3)}`
  // Build a real Date (absolute instant) using the explicit offset.
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se || '00'}${off === 'Z' ? 'Z' : offset}`
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return {
    date,
    offset,
    y, mo, d,
    h: parseInt(h, 10),
    mi: parseInt(mi, 10),
  }
}

// Given an interval END timestamp, compute the START-hour key.
// 00:15,00:30,00:45,01:00 (ends) -> all belong to hour starting 00:00.
function startHourKey(parsed) {
  // interval end minus the interval; for QH the start is end - 15min.
  // We just need the hour the interval STARTS in. Subtract 1 ms to land
  // inside the interval, then floor to the hour, using the same offset.
  const startInstant = new Date(parsed.date.getTime() - 1) // 1ms before end
  // Re-express in the original offset to get local hour.
  const offMin = offsetToMinutes(parsed.offset)
  const localMs = startInstant.getTime() + offMin * 60000
  const ld = new Date(localMs)
  const y = ld.getUTCFullYear()
  const mo = String(ld.getUTCMonth() + 1).padStart(2, '0')
  const d = String(ld.getUTCDate()).padStart(2, '0')
  const h = String(ld.getUTCHours()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:00${parsed.offset}`
}

function offsetToMinutes(off) {
  if (off === 'Z' || off === '+00:00') return 0
  const m = off.match(/([+-])(\d{2}):(\d{2})/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10))
}

// month bucket key like "2025-05" derived from the interval START hour,
// so it always agrees with startHourKey (important at month boundaries).
function monthKeyFromHourKey(hourKey) {
  // hourKey like "2025-05-01T00:00+02:00"
  return hourKey.slice(0, 7)
}

function findColumns(headerCells) {
  // Returns indices for timestamp and value columns.
  let tsIdx = -1
  let valIdx = -1
  headerCells.forEach((cell, i) => {
    const c = String(cell || '').toLowerCase()
    if (tsIdx === -1 && (c.includes('ablesezeitraum') || c.includes('zeitpunkt') || c.includes('datum') || c.includes('timestamp') || c.includes('zeit'))) {
      tsIdx = i
    }
    if (c.includes('kwh') || c.includes('verbrauch') || c.includes('messwert') || c.includes('wert')) {
      valIdx = i
    }
  })
  return { tsIdx, valIdx }
}

export function parseConsumptionFile(arrayBuffer, fileName = '') {
  let rowsRaw

  const isCsv = /\.csv$/i.test(fileName)
  if (isCsv) {
    // Decode as UTF-8, strip BOM
    let text = new TextDecoder('utf-8').decode(arrayBuffer)
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    const delimiter = detectDelimiter(text)
    rowsRaw = text
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .map((line) => splitCsvLine(line, delimiter))
  } else {
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
  }

  if (!rowsRaw || rowsRaw.length < 2) {
    throw new Error('Die Datei enthält keine erkennbaren Zeilen.')
  }

  const header = rowsRaw[0]
  let { tsIdx, valIdx } = findColumns(header)

  // Fallback: E-Control layout is column 0 = timestamp, column 3 = value
  if (tsIdx === -1) tsIdx = 0
  if (valIdx === -1) valIdx = header.length >= 4 ? 3 : header.length - 1

  const rows = []
  let skipped = 0
  for (let i = 1; i < rowsRaw.length; i++) {
    const r = rowsRaw[i]
    if (!r || r.length === 0) continue
    const parsed = parseTimestamp(r[tsIdx])
    const kwh = parseNumber(r[valIdx])
    if (!parsed || isNaN(kwh)) {
      skipped++
      continue
    }
    const hKey = startHourKey(parsed)
    rows.push({
      ts: parsed.date,
      hourKey: hKey,
      monthKey: monthKeyFromHourKey(hKey),
      kwh,
    })
  }

  if (rows.length === 0) {
    throw new Error('Keine gültigen Verbrauchswerte gefunden. Stimmt das Dateiformat (E-Control Viertelstundenwerte)?')
  }

  rows.sort((a, b) => a.ts - b.ts)

  return {
    rows,
    meta: {
      count: rows.length,
      skipped,
      start: rows[0].ts,
      end: rows[rows.length - 1].ts,
      totalKwh: rows.reduce((s, r) => s + r.kwh, 0),
    },
  }
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const counts = {
    ';': (firstLine.match(/;/g) || []).length,
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  let best = ';'
  let bestN = -1
  for (const [d, n] of Object.entries(counts)) {
    if (n > bestN) { bestN = n; best = d }
  }
  return best
}

function splitCsvLine(line, delimiter) {
  // Minimal CSV splitter with quote handling.
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === delimiter && !inQ) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

// Group rows into hourly consumption keyed by hourKey, preserving the
// absolute hour start instant for matching against spot prices.
export function aggregateHourly(rows) {
  const map = new Map()
  for (const r of rows) {
    const e = map.get(r.hourKey)
    if (e) {
      e.kwh += r.kwh
    } else {
      // hourKey is like "2025-05-01T00:00+02:00" -> absolute Date
      map.set(r.hourKey, {
        hourKey: r.hourKey,
        hourStart: new Date(r.hourKey),
        monthKey: r.monthKey,
        kwh: r.kwh,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.hourStart - b.hourStart)
}
