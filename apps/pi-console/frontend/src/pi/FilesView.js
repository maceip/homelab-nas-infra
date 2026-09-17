import React, { useState } from 'react'

export const FILE_BROWSER_URL = 'http://192.168.0.56:8080/files/'

export function StorageWarning({ overview }) {
  const storage = overview.data?.storage
  if (!overview.error && (!storage || storage.healthy)) return null
  return <aside className="storage-warning" role="alert"><strong>{overview.error ? 'Storage status unavailable' : 'Storage needs attention'}</strong><p>{overview.error ? 'The Pi could not be reached. Previously loaded status may be out of date.' : storage.message}</p><a href="/admin/files">Check files & storage →</a></aside>
}

export default function FilesView({ overview }) {
  const storage = overview.data?.storage
  const fileBrowserUrl = overview.data?.file_browser_url || FILE_BROWSER_URL
  const [revision, setRevision] = useState(0)
  const ready = storage?.healthy && !overview.error
  return <section className="pi-files">
    <header className="files-heading"><div><h1>Files & storage</h1><p>Your shared files, together in one place.</p></div><button onClick={() => { overview.refresh(); setRevision(v => v + 1) }}>Refresh</button></header>
    <div className="files-health" role="status">
      <strong>{overview.error ? 'Connection unavailable' : !storage ? 'Checking storage…' : ready ? 'Storage is readable' : 'Storage unavailable'}</strong>
      <p>{ready ? `${((storage.used / storage.total) * 100).toFixed(1)}% used · ${(storage.free / 1099511627776).toFixed(1)} TiB available` : overview.error || storage?.message || 'Waiting for the Pi.'}</p>
      {storage?.sampled_at && <small>Last checked {new Date(storage.sampled_at * 1000).toLocaleTimeString()}</small>}
      {storage?.downloads_paused && <p>Bulk model downloads are paused for storage diagnostics.</p>}
    </div>
    <div className="files-toolbar"><p>Upload, download and organize files here. File changes are live on the Pi.</p><a href={fileBrowserUrl} target="_blank" rel="noreferrer">Open file browser ↗</a></div>
    {ready ? <iframe key={revision} title="Shared files on the Pi" src={fileBrowserUrl} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" referrerPolicy="no-referrer" /> : <div className="files-unavailable">{storage || overview.error ? 'File browsing is paused until storage responds. Refresh to check again.' : 'Loading storage health…'}</div>}
    <p className="files-note">{overview.data?.deployed ? 'Keep Tailscale connected to access your files away from home.' : 'The file browser needs a connection to your home LAN.'} If embedding is blocked by your browser, use “Open file browser”.</p>
  </section>
}
