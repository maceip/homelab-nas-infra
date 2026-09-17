import React,{useEffect,useState} from 'react'
import MetrApp from './MetrApp'
import PublicHome from './PublicHome'
export default function AppGate(){
 const [mode,setMode]=useState(''),[error,setError]=useState(false)
 useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);fetch('/pi-api/session',{credentials:'same-origin',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>setMode(d.access_mode==='tailnet'?'tailnet':'public')).catch(()=>setError(true)).finally(()=>clearTimeout(timer));return()=>{clearTimeout(timer);controller.abort()}},[])
 if(error)return <main style={{padding:40,fontFamily:'system-ui'}}><h1>Connection unavailable</h1><p>Please reload when the Pi is reachable.</p><button onClick={()=>window.location.reload()}>Retry</button></main>
 if(!mode)return <p role="status" style={{padding:40,fontFamily:'system-ui'}}>Connecting to Matt’s Gateway to America…</p>
 return mode==='tailnet'?<MetrApp/>:<PublicHome/>
}
