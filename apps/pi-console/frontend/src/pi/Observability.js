import React, { useEffect, useState } from 'react'
import { request } from './api'
import { FILE_BROWSER_URL } from './FilesView'
import './observability.css'

const stamp = ts => ts ? new Date(ts * 1000).toLocaleString() : 'Not received'
const number = (value, unit) => Number.isFinite(value) ? value.toFixed(1) + unit : '—'

// Actual sample times share a 24-hour axis. Missing intervals are never joined.
export function Trend({ samples, field, max = 100, label, end }) {
  const start = end - 86400
  const points = samples.filter(s => s.ts >= start && s.ts <= end)
  let previous = null
  const path = points.map(s => {
    if (!Number.isFinite(s[field])) { previous = null; return '' }
    const command = previous && s.ts - previous.ts <= 180 ? 'L' : 'M'
    previous = s
    return `${command}${((s.ts-start)/86400*300).toFixed(2)},${(90-Math.min(max,Math.max(0,s[field]))/max*80).toFixed(2)}`
  }).join(' ')
  return <svg viewBox="0 0 300 110" role="img" aria-label={label}>
    <path d="M0 10H300M0 50H300M0 90H300" className="obs-grid"/>
    <path d={path} className="obs-line"/>
    {points.filter(s => Number.isFinite(s[field])).slice(-1).map(s => <circle key={s.ts} cx={(s.ts-start)/86400*300} cy={90-Math.min(max,Math.max(0,s[field]))/max*80} r="3" fill="currentColor"/>)}
    <text x="0" y="107">24h ago</text><text x="275" y="107">Now</text>
  </svg>
}

export function ObservabilityPanel({ data, error }) {
  const now = Date.now()/1000
  const samples = data?.samples || []
  const latest = samples[samples.length-1] || {}
  const meta = data?.meta || {}
  const available = data?.available
  const stale = !!(error || data?.stale)
  const bins = data?.activity_bins || []
  const count = bins.reduce((n,b) => n+b.count,0)
  const events = data?.events || []
  const max = Math.max(1,...bins.map(b => b.count))
  const routerStale = meta.router_received_at && now-meta.router_received_at > 7200
  return <section className="observability" aria-label="System history and suspicious activity">
    <div className="island-section-label"><h2>Home, over time</h2><span>{stale ? 'Readings may be out of date' : 'Last 24 hours · sampled every 30s'}</span></div>
    {(!available || stale || meta.journal_error) && <p className="obs-warning" role="status">{error || meta.journal_error || (stale ? 'Collector readings are stale. Activity coverage may be incomplete.' : data?.reason || 'Loading real system history…')}</p>}
    <div className="obs-charts">
      <article className="obs-card obs-cpu"><h3>CPU utilization</h3><strong>{number(latest.cpu,'%')}</strong><Trend samples={samples} field="cpu" label="CPU utilization over 24 hours, zero to 100 percent" end={now}/></article>
      <article className="obs-card obs-heat"><h3>Temperature</h3><strong>{number(latest.temp,' °C')}</strong><Trend samples={samples} field="temp" label="Temperature over 24 hours, zero to 100 degrees Celsius" end={now}/><p>Storage PCIe link: {meta.pcie_speed || 'unavailable'}</p></article>
      <article className="obs-card obs-activity"><h3>Suspicious activity</h3><strong>{available ? count : '—'} <small>review signals</small></strong>
        <svg viewBox="0 0 300 110" role="img" aria-label={available ? `${count} activity review signals in five-minute bins over 24 hours` : 'Activity data unavailable'}>
          <path d="M0 10H300M0 50H300M0 90H300" className="obs-grid"/>
          {bins.filter(b=>b.ts>=now-86400 && b.ts<=now).map(b=><rect key={b.ts} x={Math.max(0,(b.ts-(now-86400))/86400*298)} y={90-b.count/max*80} width="2" height={b.count/max*80} fill="currentColor"><title>{stamp(b.ts)}: {b.count} signals</title></rect>)}
          <text x="0" y="107">24h ago</text><text x="275" y="107">Now</text>
        </svg><p>Patterns worth reviewing. Single denied probes stay in the background count.</p>
      </article>
    </div>
    <details className="obs-details"><summary>Activity details & detection coverage</summary>
      <p>{data?.rules || 'Waiting for detection coverage.'}</p>
      <p>{available ? data?.counts?.auth_failure || 0 : 'Unknown'} rejected SSH attempts · {available ? data?.counts?.web_probe || 0 : 'unknown'} sensitive-path requests in available logs. No signals does not establish that the network is secure.</p>
      <p>Journal collection started {stamp(meta.journal_started_at)}. Gaps and pre-reset router history may be unavailable. Hardware faults appear below but are excluded from the suspicious-activity graph.</p>
      {events.length ? <ol className="obs-events">{events.map((e,i)=><li key={`${e.ts}-${i}`}><time>{stamp(e.ts)}</time><span className={'obs-severity '+e.severity}>{e.severity}</span><strong>{e.source}</strong><p>{e.summary}</p></li>)}</ol> : <p>No review signals in the available log window.</p>}
    </details>
    <details className="obs-details"><summary>Archer router logs <span className={routerStale || !meta.router_received_at ? 'obs-late' : 'obs-connected'}>{!meta.router_received_at ? 'Awaiting first export' : routerStale ? 'Delivery overdue' : 'Receiving'}</span></summary>
      <p>Last received: {stamp(meta.router_received_at)}. Scheduled hourly over your LAN; this is a periodic export, not a live stream. Event timestamps may be older than delivery.</p>
      {meta.router_error && <p className="obs-warning">{meta.router_error}</p>}
      <p>Original exports retained locally for up to 30 days, within a 1 GiB limit. Preview is limited to 80 lines and hides common credential fields.</p>
      {meta.router_excerpt ? <pre className="obs-router-log">{meta.router_excerpt}</pre> : <p>No router log text has arrived yet.</p>}
    </details>
  </section>
}

export function SharedFilesWidget({ overview }) {
  const storage = overview.data?.storage
  const ready = storage?.healthy && !overview.error
  const url = overview.data?.file_browser_url || FILE_BROWSER_URL
  return <section className="obs-files" aria-label="Shared file browser">
    <div className="island-section-label"><h2>Your shared files</h2><a href="/admin/files">Files & storage ↗</a></div>
    <p>Upload, download and organize here. Changes are live on the Pi.</p>
    {ready ? <iframe title="Shared files dashboard widget" src={url} loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" referrerPolicy="no-referrer"/> : <p className="obs-warning">{overview.error ? 'Storage status unavailable. Reconnect before opening files.' : storage?.message || 'Checking storage before opening files…'}</p>}
    <p>{overview.data?.deployed ? 'Keep Tailscale connected when away from home. ' : ''}{ready && <a href={url} target="_blank" rel="noreferrer">Open file browser separately ↗</a>}</p>
  </section>
}

export default function Observability({ overview }) {
  const [data,setData] = useState(null)
  const [error,setError] = useState('')
  useEffect(()=>{
    let stopped=false
    const poll=async()=>{ try { const result=await request('observability'); if(!stopped){setData(result);setError('')} } catch(e){if(!stopped)setError(e.message || 'Unable to read telemetry.')} }
    poll();const timer=setInterval(poll,30000)
    return ()=>{stopped=true;clearInterval(timer)}
  },[])
  return <><ObservabilityPanel data={data} error={error}/><SharedFilesWidget overview={overview}/></>
}
