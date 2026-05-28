// Proxy for https://api.energy-charts.info/price
// The upstream API restricts its CORS header to its own origin, so browser
// fetches are blocked. This function runs server-side and forwards the response.

const UPSTREAM = 'https://api.energy-charts.info/price'
const ALLOWED_BZN = new Set(['AT', 'DE-LU', 'CH', 'CZ', 'HU', 'SK', 'SI'])

export default async function handler(req) {
  const url = new URL(req.url)
  const bzn = url.searchParams.get('bzn') || 'AT'
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  if (!ALLOWED_BZN.has(bzn)) {
    return new Response('Invalid bzn parameter.', { status: 400 })
  }
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return new Response('start and end must be YYYY-MM-DD dates.', { status: 400 })
  }

  const upstream = new URL(UPSTREAM)
  upstream.searchParams.set('bzn', bzn)
  upstream.searchParams.set('start', start)
  upstream.searchParams.set('end', end)

  const upstreamRes = await fetch(upstream.toString())
  const body = await upstreamRes.text()

  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
