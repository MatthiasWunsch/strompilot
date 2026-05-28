import { spotEurPerKwh } from './spotPrices'

const VAT = 0.20 // 20% USt in Austria

const MONTH_NAMES = [
  'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

export function monthLabelShort(monthKey) {
  const [y, m] = monthKey.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1].slice(0, 3)} ${y.slice(2)}`
}

// Compute per-month comparison.
//
// Inputs:
//   hourly: [{ hourStart, monthKey, kwh }]
//   byHour: Map(unixSec -> EUR/MWh net)
//   surchargeCtPerKwh: fixed dynamic-tariff surcharge in ct/kWh (gross, like aWattar ~1.5)
//   fixedPrices: { [monthKey]: ctPerKwhGross }  user's actual paid energy price
//
// Dynamic gross price per hour =
//   spot_net(EUR/kWh) * (1 + VAT) * 100  -> ct/kWh, plus surcharge ct/kWh
//
// Returns { months: [...], totals: {...}, coverage: {...} }
export function computeComparison(hourly, byHour, surchargeCtPerKwh, fixedPrices) {
  const months = new Map()
  let missingHours = 0
  let matchedHours = 0

  for (const h of hourly) {
    const spot = spotEurPerKwh(byHour, h.hourStart) // EUR/kWh net or null
    let m = months.get(h.monthKey)
    if (!m) {
      m = {
        monthKey: h.monthKey,
        kwh: 0,
        dynamicCost: 0,      // €, gross
        spotWeightedNumerator: 0, // for avg net spot ct/kWh
        spotKwh: 0,
        hoursTotal: 0,
        hoursMissing: 0,
      }
      months.set(h.monthKey, m)
    }
    m.kwh += h.kwh
    m.hoursTotal += 1

    if (spot == null) {
      m.hoursMissing += 1
      missingHours += 1
      continue
    }
    matchedHours += 1
    const spotCtGross = spot * (1 + VAT) * 100 // ct/kWh gross
    const dynRateCt = spotCtGross + surchargeCtPerKwh // ct/kWh gross
    m.dynamicCost += (h.kwh * dynRateCt) / 100 // €
    m.spotWeightedNumerator += spot * 100 * h.kwh // net ct * kWh
    m.spotKwh += h.kwh
  }

  const monthList = Array.from(months.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  )

  const result = monthList.map((m) => {
    const fixedCt = fixedPrices[m.monthKey]
    const hasFixed = fixedCt != null && fixedCt !== '' && !isNaN(parseFloat(fixedCt))
    const fixedRate = hasFixed ? parseFloat(fixedCt) : null
    const fixedCost = hasFixed ? (m.kwh * fixedRate) / 100 : null

    // Scale dynamic cost to full month if some hours are missing, so the
    // comparison stays fair (only when coverage is partial but meaningful).
    let dynamicCost = m.dynamicCost
    let dynamicEstimated = false
    if (m.hoursMissing > 0 && m.spotKwh > 0) {
      const avgDynPerKwh = m.dynamicCost / m.spotKwh
      dynamicCost = avgDynPerKwh * m.kwh
      dynamicEstimated = true
    }

    const avgSpotNetCt = m.spotKwh > 0 ? m.spotWeightedNumerator / m.spotKwh : null
    const avgDynGrossCt = m.kwh > 0 ? (dynamicCost / m.kwh) * 100 : null

    return {
      monthKey: m.monthKey,
      label: monthLabel(m.monthKey),
      labelShort: monthLabelShort(m.monthKey),
      kwh: m.kwh,
      fixedRate,
      fixedCost,
      dynamicCost,
      dynamicEstimated,
      avgSpotNetCt,
      avgDynGrossCt,
      savings: hasFixed ? fixedCost - dynamicCost : null, // + means dynamic cheaper
      hoursTotal: m.hoursTotal,
      hoursMissing: m.hoursMissing,
    }
  })

  const totals = result.reduce(
    (acc, m) => {
      acc.kwh += m.kwh
      acc.dynamicCost += m.dynamicCost
      if (m.fixedCost != null) {
        acc.fixedCost += m.fixedCost
        acc.dynamicCostWhereFixed += m.dynamicCost
        acc.comparableMonths += 1
      }
      return acc
    },
    { kwh: 0, dynamicCost: 0, fixedCost: 0, dynamicCostWhereFixed: 0, comparableMonths: 0 }
  )
  totals.savings = totals.fixedCost - totals.dynamicCostWhereFixed

  return {
    months: result,
    totals,
    coverage: { matchedHours, missingHours, totalHours: matchedHours + missingHours },
  }
}

export { VAT }
