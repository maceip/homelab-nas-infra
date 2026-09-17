import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../vendor/animal-island/Card/Card'
import { Button } from '../vendor/animal-island/Button/Button'
import { Tag } from '../vendor/animal-island/Tag/Tag'
import { Progress } from '../vendor/animal-island/Progress/Progress'
import mapArt from '../vendor/animal-island/assets/img/icons/icon-map.svg'
import chatArt from '../vendor/animal-island/assets/img/icons/icon-chat.svg'
import diyArt from '../vendor/animal-island/assets/img/icons/icon-diy.svg'
import leafArt from '../vendor/animal-island/assets/img/icons/icon-leaf.png'
import { formatBytes, needsSetup, serviceState } from './api'
import { mountLiquidGlass } from './liquidGlass'
import Observability from './Observability'

export function IslandArt() {
  const host = useRef(null)
  useEffect(() => mountLiquidGlass(host.current), [])
  return <div className="island-art" ref={host} data-glass="fallback" aria-hidden="true">
    <div className="island-art-orbit" />
    <div className="island-glass-tile"><img src={mapArt} alt="" /></div>
    <span className="island-orbit-dot dot-one" /><span className="island-orbit-dot dot-two" />
    <span className="island-art-label"><span className="island-signal" />Your little corner of the internet</span>
    <img className="island-floating-leaf" src={leafArt} alt="" />
  </div>
}

const Glyph = ({ type }) => <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {type === 'services' ? <><rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M13 6.5h4M13 17.5h4"/></> : type === 'memory' ? <><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4M19 9h4m-4 6h4M9 9h6v6H9z"/></> : type === 'disk' ? <><path d="M5 5h14l3 12H2L5 5Z"/><rect x="2" y="12" width="20" height="8" rx="2"/><path d="M16 16h2"/></> : <><path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v9"/></>}
</svg>

export default function IslandOverview({ overview }) {
  const { data: d, error, loading, refresh } = overview
  const navigate = useNavigate()
  const running = d?.services.filter(s => serviceState(s) === 'Running').length || 0
  const pending = d?.services.filter(needsSetup) || []
  const failed = d?.services.filter(s => serviceState(s) === 'Failed') || []
  const memory = d ? ((d.memory_total - d.memory_available) / d.memory_total) * 100 : 0
  const disk = d ? (d.disk_free / d.disk_total) * 100 : 0
  return <div className="island-overview">
    <div className="island-page-heading"><div><span className="island-eyebrow">HOME BASE</span><h1>Your Pi, at a glance</h1></div><Button size="small" onClick={refresh} aria-label="Refresh">↻ &nbsp; Refresh</Button></div>
    {error && <div className="island-error" role="alert"><strong>Connection unavailable</strong><p>{error}</p><small>Previously loaded values may be out of date.</small></div>}
    <section className="island-hero">
      <div className="island-hero-copy"><Tag color={error ? 'app-red' : 'app-teal'} size="small" variant="soft">{error ? 'Connection interrupted' : d ? 'Live from your Raspberry Pi' : 'Connecting to your Pi'}</Tag>
        <h2>Your home.<br/><em>A little more connected.</em></h2>
        <p>One cozy place for your services, devices,<br className="island-desktop-break"/> and everything running back at home.</p>
        <Button type="primary" onClick={() => navigate('/admin/services')}>Explore your services <span aria-hidden="true">↗</span></Button>
      </div>
      <IslandArt />
    </section>
    {!d ? <div role="status" className="island-loading">{loading && !error ? 'Reading the Pi…' : 'Use Refresh to reconnect.'}</div> : <>
      <div className="island-section-label"><h2>A pulse on home</h2><span>{error ? 'Last known values' : 'Updated ' + new Date(d.sampled_at * 1000).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span></div>
      <section className="island-metrics" aria-label="Live system metrics">
        <Card className="island-metric mint" pattern="app-teal"><div className="island-metric-top"><span className="island-glyph"><Glyph type="services"/></span><span>Services</span><span className="island-mini-label">{error ? 'STALE' : 'LIVE'}</span></div><div className="island-metric-value">{running}<small>running</small></div><Progress percent={running / d.services.length * 100} size="small" showInfo={false} aria-label="Running services"/><p>{d.services.length} installed software groups</p></Card>
        <Card className="island-metric peach" pattern="app-orange"><div className="island-metric-top"><span className="island-glyph"><Glyph type="memory"/></span><span>Memory</span></div><div className="island-metric-value">{formatBytes(d.memory_total - d.memory_available)}</div><Progress percent={memory} size="small" showInfo={false} aria-label="Memory in use"/><p>{formatBytes(d.memory_total)} total · {Math.round(memory)}% in use</p></Card>
        <Card className="island-metric lavender" pattern="purple"><div className="island-metric-top"><span className="island-glyph"><Glyph type="disk"/></span><span>Free space</span></div><div className="island-metric-value">{formatBytes(d.disk_free)}</div><Progress percent={disk} size="small" showInfo={false} aria-label="System disk free"/><p>System volume · {Math.round(disk)}% free</p></Card>
        <Card className="island-metric butter" pattern="app-yellow"><div className="island-metric-top"><span className="island-glyph"><Glyph type="temperature"/></span><span>Temperature</span></div><div className="island-metric-value">{d.temperature === null ? '—' : d.temperature.toFixed(1)}<small>°C</small></div><div className="island-temperature-note">{d.temperature === null ? 'Sensor unavailable' : d.temperature < 70 ? 'Taking it easy' : 'Running warm'}</div><p>{(d.uptime / 3600).toFixed(1)} hours uptime</p></Card>
      </section>
      <Observability overview={overview}/>
      <section className="island-lower-grid">
        <Card className="island-next"><div className="island-card-heading"><div><span className="island-eyebrow">A LITTLE TLC</span><h2>Ready for the next step</h2></div><Tag color="app-orange" size="small">{pending.length} to set up</Tag></div>
          <p className="island-muted">A few things could use your attention.</p>
          {failed.length > 0 && <div className="island-error" role="alert">{failed.length} service{failed.length === 1 ? '' : 's'} reporting a failure. Check their logs in Services.</div>}
          <div className="island-tasks">{pending.slice(0,4).map((s,i) => <button key={s.id} className="island-task" onClick={() => navigate('/admin/services/' + s.id)}><span className={'island-task-icon task-' + i}><img src={i % 2 ? chatArt : diyArt} alt=""/></span><span className="island-task-copy"><strong>{s.name}</strong><small>{s.readiness}</small></span><span className="island-task-arrow" aria-hidden="true">↗</span></button>)}</div>
          {!pending.length && <p>No outstanding setup notes.</p>}
          <Button type="text" className="island-view-all" onClick={() => navigate('/admin/services')}>View all services <span aria-hidden="true">→</span></Button>
        </Card>
        <div className="island-side-stack"><Card className="island-private" pattern="app-blue"><div className="island-card-heading"><span className="island-round-icon">⌁</span><Tag color="app-blue" size="small">HEADSCALE</Tag></div><h2>A way back home</h2><p>Your devices, connected privately.<br/>Your everyday internet stays where you are.</p><Button onClick={() => navigate('/admin/access')}>View connected devices <span aria-hidden="true">→</span></Button></Card>
          <Card className="island-network" type="dashed"><h3>Your network, as you like it.</h3><p>Your switch and Wi-Fi access point stay in charge. The Pi takes care of its own services.</p><button onClick={() => navigate('/admin/network')}>Take a look at the network <span aria-hidden="true">↗</span></button></Card>
        </div>
      </section>
      <footer className="island-footer"><span><span className="island-signal"/>{d.hostname}</span><span>Small computer. A lot of possibility.</span></footer>
    </>}
  </div>
}
