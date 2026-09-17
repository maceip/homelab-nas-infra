import React, { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom'
import { request, serviceState, needsSetup, formatBytes } from './api'
import FilesView, { StorageWarning } from './FilesView'
import { ObservabilityPanel, SharedFilesWidget } from './Observability'
import SystemInstruments from './SystemInstruments'
import './files.css'
import './metr.css'
import './brand.css'
import {BrandMark,BrandHero} from './Brand'

export const navigation = [['home', 'Overview'], ['files', 'Files & storage'], ['services', 'Services'], ['access', 'Private access'], ['network', 'Network'], ['tests', 'Tests'], ['settings', 'Settings']]
export function usePiResource(path, interval = 20000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let alive = true
    let pending = false
    const update = async () => {
      if (pending || document.hidden) return
      pending = true
      try { const value = await request(path); if (alive) { setData(value); setError('') } }
      catch (e) { if (alive) setError(e.message || 'Unable to reach the Pi.') }
      finally { pending = false; if (alive) setLoading(false) }
    }
    setLoading(true); update()
    document.addEventListener('visibilitychange', update)
    const timer = interval ? setInterval(update, interval) : null
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [path, interval, revision])
  return { data, error, loading, refresh: () => setRevision(n => n + 1) }
}
const date = ts => ts ? new Date(typeof ts === 'number' ? ts * 1000 : ts).toLocaleString() : 'Not recorded'
const number = (n, suffix = '') => Number.isFinite(n) ? n.toFixed(1) + suffix : '—'
const Arrow = () => <span aria-hidden="true">↗</span>
const Mark = BrandMark
export const State = ({ children, good, bad }) => <span className={'metr-state ' + (bad ? 'is-bad' : good ? 'is-good' : '')}><span aria-hidden="true"/>{children}</span>
const Refresh = ({ resource }) => <button className="metr-button secondary" onClick={resource.refresh} disabled={resource.loading}>{resource.loading ? 'Refreshing…' : 'Refresh'} <span aria-hidden="true">↻</span></button>
export const Notice = ({ resource }) => resource.error ? <div role="alert" className="metr-notice"><strong>Connection unavailable</strong><p>{resource.error} Previously loaded values may be out of date.</p><button className="metr-text-button" onClick={resource.refresh}>Try again →</button></div> : null
const Loading = () => <p className="metr-empty" role="status">Reading your Pi…</p>
const PageHead = ({ eyebrow, title, description, resource }) => <header className="metr-page-head"><div><span className="metr-eyebrow">{eyebrow || 'YOUR HOME SERVER'}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{resource && <Refresh resource={resource}/>}</header>

export function MetrHome({ overview }) {
  const telemetry = usePiResource('observability', 30000)
  const d = overview.data
  const services = d?.services || []
  const running = services.filter(s => serviceState(s) === 'Running').length
  const storage = d?.storage
  return <>
    <BrandHero privateMode overview={overview}/>
    <Notice resource={overview}/>
    <SystemInstruments telemetry={telemetry.data} overview={d} error={telemetry.error} overviewError={overview.error}/>
    <section className="metr-metrics" aria-label="Live system metrics"><div><span>Services running</span><strong>{d ? running : '—'}<small>{d ? ' / ' + services.length : ''}</small></strong><span>Installed software groups</span></div><div><span>Memory in use</span><strong>{d ? formatBytes(d.memory_total - d.memory_available) : '—'}</strong><span>{d ? formatBytes(d.memory_total) + ' total' : 'Awaiting readings'}</span></div><div><span>System disk free</span><strong>{d ? formatBytes(d.disk_free) : '—'}</strong><span>Pi system volume · separate from NAS</span></div><div><span>Uptime</span><strong>{d ? number(d.uptime / 3600, ' h') : '—'}</strong><span>Since the last boot</span></div></section>
    <ObservabilityPanel data={telemetry.data} error={telemetry.error}/>
    <SharedFilesWidget overview={overview}/>
    <section className="metr-section"><div className="metr-section-head"><div><h2>Your services</h2><p>What’s running, and what needs a little attention.</p></div><Link to="/admin/services">View all services <Arrow/></Link></div><ServiceCollection services={services} featured/><div className="metr-footnote">Process status is live. Setup notes describe recorded checks; a running process does not mean every feature is configured.</div></section>
    <section className="metr-home-network"><div><span className="metr-eyebrow">CONNECTED, YOUR WAY</span><h2>At home. And wherever you go.</h2></div><div><p>Open the dashboard directly on your home Wi-Fi. When you’re out, Tailscale gives your devices a private connection back to the Pi.</p><p>Your router and access point keep managing your network.</p><Link className="metr-button" to="/admin/network">View your network <Arrow/></Link></div></section>
  </>
}

export function ServiceCollection({ services, featured = false }) {
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const filters = featured ? ['All', 'Running', 'Needs setup'] : ['All', ...new Set(services.map(s => s.group))]
  const matching = services.filter(s => (filter === 'All' || (featured ? filter === 'Running' ? serviceState(s) === 'Running' : needsSetup(s) : s.group === filter)) && `${s.name} ${s.notes || ''} ${s.group}`.toLowerCase().includes(query.toLowerCase()))
  const visible = featured && !expanded ? matching.slice(0, 3) : matching
  return <>
    {!featured && <div className="metr-search"><label htmlFor="service-search">Find a service</label><input id="service-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or purpose…"/></div>}
    <div className="metr-filters" role="group" aria-label="Filter services">{filters.map(f => <button key={f} aria-pressed={f === filter} onClick={() => { setFilter(f); setExpanded(false) }}>{f}</button>)}</div>
    <div className="metr-service-grid">{visible.map(s => <Link className="metr-service-card" key={s.id} to={'/admin/services/' + s.id}><div className="metr-card-top"><span className="metr-eyebrow">{s.group}</span><State good={serviceState(s) === 'Running'} bad={serviceState(s) === 'Failed'}>{serviceState(s)}</State></div><h3>{s.name}</h3><p className="metr-readiness">{s.readiness}</p><p className="metr-card-notes">{s.notes}</p><span className="metr-card-link">Status & details <Arrow/></span></Link>)}</div>
    {!matching.length && <p className="metr-empty">No services match this filter.</p>}
    {featured && matching.length > 3 && <button className="metr-button secondary metr-view-all" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Show fewer services' : `View all ${matching.length} services`} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
  </>
}
function Services({ overview }) { return <><PageHead title="Your services" description="Software installed on your Pi, with live process status." resource={overview}/><Notice resource={overview}/>{!overview.data && overview.loading ? <Loading/> : <ServiceCollection services={overview.data?.services || []}/>}</> }
export function MetrServiceDetail({ overview }) {
  const { id } = useParams()
  const service = overview.data?.services.find(s => s.id === id)
  const [logs, setLogs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setLogs(null); setMessage('') }, [id])
  if (!service) return <><Link to="/admin/services">← All services</Link><Notice resource={overview}/>{overview.loading ? <Loading/> : <p>Service unavailable. Refresh the dashboard or choose another service.</p>}</>
  const loadLogs = async () => { setBusy(true); setMessage(''); try { setLogs((await request(`services/${id}/logs`)).text) } catch(e) { setMessage(e.message) } finally { setBusy(false) } }
  const act = async verb => { setBusy(true); setMessage(''); try { await request(`services/${id}/${verb}`, {}); setMessage('Action completed. Refreshing status…'); overview.refresh() } catch(e) { setMessage(e.message) } finally { setBusy(false) } }
  return <><Link className="metr-back" to="/admin/services">← All services</Link><PageHead eyebrow={service.group} title={service.name} resource={overview}/><Notice resource={overview}/><State good={serviceState(service) === 'Running'} bad={serviceState(service) === 'Failed'}>{serviceState(service)}</State><section className="metr-detail-section"><h2>Configuration & verification</h2><div><strong>{service.readiness}</strong><p>{service.notes}</p><p className="metr-muted">Setup notes describe recorded checks. Process status is refreshed live.</p><a href={service.source} target="_blank" rel="noreferrer">Upstream documentation <Arrow/></a></div></section><section className="metr-detail-section"><h2>Service controls</h2><div>{service.unit ? <><div className="metr-actions">{['start','stop','restart'].map(verb => <button className="metr-button secondary" key={verb} disabled={busy || !!overview.error || overview.data.read_only !== false || service.protected} onClick={() => act(verb)}>{verb[0].toUpperCase() + verb.slice(1)}</button>)}</div><p>{service.protected ? 'Connectivity services are protected from changes here.' : overview.data.read_only !== false ? 'Service changes are disabled.' : 'Actions apply to this application’s existing system service.'}</p></> : <p>This is an on-demand tool, or its service has not been configured.</p>}</div></section>{message && <p role="status" className="metr-notice">{message}</p>}{service.unit && <section className="metr-section"><div className="metr-section-head"><div><h2>Recent logs</h2><p>Last 100 entries; credentials are redacted.</p></div><button className="metr-button secondary" onClick={loadLogs} disabled={busy}>{busy ? 'Loading…' : 'Read logs'}</button></div>{logs === null ? <p className="metr-empty">Load recent entries for this service.</p> : <pre className="metr-log">{logs || 'No log entries.'}</pre>}</section>}</>
}
function Access() {
  const r = usePiResource('vpn')
  const [authId, setAuthId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const approve = async e => { e.preventDefault(); setBusy(true); try { const d = await request('vpn/register', {auth_id:authId.trim()}); setMessage(`${d.name} approved`); setAuthId(''); r.refresh() } catch(e) {setMessage(e.message)} finally {setBusy(false)} }
  return <><PageHead title="A way back home" eyebrow="PRIVATE ACCESS" description="Your Headscale network and enrolled devices." resource={r}/><Notice resource={r}/><section className="metr-detail-section"><h2>Connect your devices</h2><div><p className="metr-address">{r.data?.server || 'https://matts.public.computer'}</p><p>Choose this alternate server in the Tailscale app. Set Exit node to None to reach home while keeping ordinary internet traffic on your current connection.</p><div className="metr-address-pair"><div><span>On home Wi-Fi</span><a href="https://matts.public.computer/">matts.public.computer <Arrow/></a></div><div><span>Through Tailscale</span><a href="https://matts.public.computer/">matts.public.computer <Arrow/></a></div></div></div></section><section className="metr-section"><h2>Your devices</h2>{!r.data && r.loading ? <Loading/> : <div className="metr-row-list">{(r.data?.nodes || []).map(n => <article className="metr-row" key={n.id}><div><h3>{n.name}</h3><p>{n.addresses.join(' · ')}</p><small>{n.user}</small></div><State good={n.online}>{n.online ? 'Online' : 'Offline'}</State></article>)}{r.data && !r.data.nodes.length && <p>No devices registered yet.</p>}</div>}</section><section className="metr-detail-section"><h2>Add a phone</h2><form onSubmit={approve}><label htmlFor="auth-id">Authentication ID from your phone</label><input id="auth-id" value={authId} onChange={e => setAuthId(e.target.value)} placeholder="Authentication ID" autoComplete="off"/><button className="metr-button" disabled={!authId.trim() || busy || !!r.error || r.data?.read_only !== false}>{busy ? 'Approving…' : 'Approve for owner'}</button>{r.data?.read_only && <p>Device approval is disabled in this dashboard.</p>}{message && <p role="status">{message}</p>}</form></section></>
}
function Network({ overview }) {
  const d = overview.data
  return <><PageHead title="Your home network" description="The Pi’s live interfaces and routes. Your router and access point manage the LAN." resource={overview}/><Notice resource={overview}/>{!d ? <Loading/> : <><section className="metr-section"><h2>Interfaces</h2><div className="metr-row-list">{(d.interfaces || []).filter(i => i.ifname !== 'lo').map(i => <article className="metr-row" key={i.ifindex}><div><h3>{i.ifname}</h3><p>{i.addr_info.filter(a => a.scope === 'global').map(a => `${a.local}/${a.prefixlen}`).join(' · ') || 'No global address'}</p></div><State good={i.operstate === 'UP'}>{i.operstate}</State></article>)}</div></section><section className="metr-detail-section"><h2>Default routes</h2><div>{(d.routes || []).filter(r => r.dst === 'default').map((r,i) => <p key={i}>{r.dev} → {r.gateway} <small>Metric {r.metric ?? 'default'}</small></p>)}</div></section></>}</>
}
function Tests() {
  const r = usePiResource('tests', 30000)
  return <><PageHead title="Evidence, not assumptions" eyebrow="TESTS & VERIFICATION" description="Recorded test results for the dashboard and your Pi’s services." resource={r}/><Notice resource={r}/>{!r.data ? <Loading/> : <><section className="metr-test-summary"><h2>{r.data.state}</h2><p>{r.data.summary || 'No summary recorded.'}</p><small>Recorded {date(r.data.recorded_at)}. Results describe that run, not a continuous health check.</small></section><div className="metr-row-list">{(r.data.suites || []).map(s => <article className="metr-test-row" key={s.name}><div><h3>{s.name}</h3><p>{s.detail}</p>{s.recorded_at && <small>Recorded {date(s.recorded_at)}</small>}</div><State good={s.state === 'Passed'} bad={s.state === 'Failed'}>{s.state}</State></article>)}</div></>}</>
}
function Settings({ overview }) {
  const resource=usePiResource('settings',0)
  const inbox=usePiResource('inbox',30000)
  const [form,setForm]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{if(resource.data)setForm({...resource.data,trusted_admin_ips:resource.data.trusted_admin_ips.join('\n')})},[resource.data])
  const save=async event=>{event.preventDefault();setBusy(true);try{await request('settings',{...form,ssh_burst_threshold:Number(form.ssh_burst_threshold),web_probe_threshold:Number(form.web_probe_threshold),trusted_admin_ips:form.trusted_admin_ips.split(/\s+/).filter(Boolean)});setMessage('Settings saved. The collector applies them on its next cycle.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
  return <><PageHead title="Private settings" description="Available through your Tailscale connection."/><Notice resource={resource}/><section className="metr-detail-section"><h2>Activity signals</h2>{form&&<form onSubmit={save}><p>These settings change alert thresholds. They do not grant network access or suppress the underlying audit log.</p><label>SSH failures in five minutes <input type="number" min="5" max="50" value={form.ssh_burst_threshold} onChange={e=>setForm({...form,ssh_burst_threshold:e.target.value})}/></label><br/><label>Sensitive-path probes in five minutes <input type="number" min="10" max="100" value={form.web_probe_threshold} onChange={e=>setForm({...form,web_probe_threshold:e.target.value})}/></label><p><label>Known administrator IP addresses<br/><textarea rows="5" value={form.trusted_admin_ips} onChange={e=>setForm({...form,trusted_admin_ips:e.target.value})}/></label></p><button className="metr-button" disabled={busy||overview.data?.read_only}>Save settings</button><p role="status">{message}</p></form>}</section><section className="metr-detail-section"><h2>Service configuration</h2><div><p>Start, stop and restart eligible services from their detail pages. Connectivity services remain protected.</p><Link to="/admin/services">Manage services →</Link><p>Public deliveries are stored separately in the protected inbox, with a 50 MB per-file limit and seven-day retention.</p></div></section><section className="metr-detail-section"><h2>Public upload inbox</h2><div><Notice resource={inbox}/>{(inbox.data?.files||[]).map(file=><div className="metr-row" key={file.id}><div><strong>{file.name}</strong><p>{formatBytes(file.size)} · {date(file.ts)}</p></div><a href={'/pi-api/inbox/'+file.id}>Download</a></div>)}{inbox.data&&!inbox.data.files.length&&<p>No files in the inbox.</p>}<p>Uploaded files stay separate from your NAS and expire after seven days. Downloads are attachments.</p></div></section><About/></>
}
function About() {
  const r = usePiResource('provenance', 0)
  return <><PageHead title="Matt’s Gateway to America" eyebrow="ABOUT THIS DASHBOARD" description="An interface for the services running at home."/><section className="metr-detail-section"><h2>Built for your Pi</h2><div><p>Live status, private access, system history and shared files in one place. The dashboard reads the Pi’s standalone services directly, or through SSH in a laptop preview.</p><p>Your router and access point manage the network. This dashboard does not run SPR’s router runtime.</p></div></section><section className="metr-detail-section"><h2>Design & sources</h2><div><p>Native React web components, with typography, color and layout adapted from the METR reference. Instrument Sans and the green wave illustration are served locally.</p><p>The earlier SPR and Island implementations are retained in the source repository. This interface uses the same Pi API and access protections.</p><a href="https://github.com/spr-networks/super" target="_blank" rel="noreferrer">Original SPR project <Arrow/></a>{r.data?.commit && <p className="metr-muted">Upstream revision {r.data.commit}</p>}<Notice resource={r}/></div></section></>
}

export function MetrLayout() {
  const overview = usePiResource('overview')
  const location = useLocation()
  const main = useRef(null)
  const previousPath = useRef(location.pathname)
  useEffect(() => { if (previousPath.current !== location.pathname) {window.scrollTo(0, 0); main.current?.focus(); previousPath.current = location.pathname} }, [location.pathname])
  return <div className="metr-ui brand-refresh private-dashboard"><a className="metr-skip" href="#main">Skip to content</a><main id="main" ref={main} tabIndex={-1} className="metr-container metr-main"><StorageWarning overview={overview}/><Routes><Route path="/admin/home" element={<MetrHome overview={overview}/>}/><Route path="/admin/files" element={<><Notice resource={overview}/><FilesView overview={overview}/></>}/><Route path="/admin/services" element={<Services overview={overview}/>}/><Route path="/admin/services/:id" element={<MetrServiceDetail overview={overview}/>}/><Route path="/admin/access" element={<Access/>}/><Route path="/admin/network" element={<Network overview={overview}/>}/><Route path="/admin/tests" element={<Tests/>}/><Route path="/admin/settings" element={<Settings overview={overview}/>}/><Route path="*" element={<Navigate to={'/admin/home'+location.hash} replace/>}/></Routes></main><footer className="metr-footer brand-footer"><div className="metr-container"><div className="metr-footer-top"><div><Link to="/admin/home" className="metr-brand" aria-label="Matt’s Gateway to America home"><Mark/></Link><p>A place for your files and services.<br/>Running at home, on your terms.</p></div><div><h2>Explore</h2><Link to="/admin/services">Services</Link><Link to="/admin/files">Files & storage</Link><Link to="/admin/tests">Tests & verification</Link></div><div><h2>Connect</h2><Link to="/admin/access">Private access</Link><Link to="/admin/network">Home network</Link><Link to="/admin/settings">Settings & about</Link></div></div><div className="metr-footer-bottom"><span>Matt’s Gateway to America</span><State good={!!overview.data && !overview.error} bad={!!overview.error}>{overview.error ? 'Connection unavailable' : overview.data ? 'Live from your Raspberry Pi' : 'Connecting'}</State></div></div></footer></div>
}
export default function MetrApp() { return <BrowserRouter><MetrLayout/></BrowserRouter> }
