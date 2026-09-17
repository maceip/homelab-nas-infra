import React,{useEffect,useRef,useState} from 'react'
import {gatewayTools,registerGatewayTools,temperatureResult,deliverFile} from './gatewayTools'
import './webmcp.css'
export default function WebMCPWidget(){
 const [open,setOpen]=useState(false),[enabled,setEnabled]=useState(true),[connection,setConnection]=useState('Checking browser support'),[watch,setWatch]=useState(false),[reading,setReading]=useState(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[letter,setLetter]=useState(''),[file,setFile]=useState(null)
 const fileRef=useRef(null),pending=useRef(false),cache=useRef(null),tempPending=useRef(null),toggle=useRef(null),panel=useRef(null),life=useRef(null)
 fileRef.current=file
 useEffect(()=>{life.current=new AbortController();return()=>life.current.abort()},[])
 const temperature=async(signal)=>{
  if(cache.current&&Date.now()-cache.current.at<15000)return cache.current.value
  if(tempPending.current)return tempPending.current
  const request=async()=>{
   const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,10000)
   signal?.addEventListener('abort',abort,{once:true});life.current?.signal.addEventListener('abort',abort,{once:true})
   if(signal?.aborted)abort()
   try{const response=await fetch('/public-api/metrics',{signal:controller.signal});if(!response.ok)throw Error('Temperature temporarily unavailable.');const value=temperatureResult(await response.json());cache.current={at:Date.now(),value};setReading(value);return value}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);life.current?.signal.removeEventListener('abort',abort)}
  }
  tempPending.current=request();try{return await tempPending.current}finally{tempPending.current=null}
 }
 const upload=async(candidate,signal)=>{
  if(pending.current)throw Error('One delivery is already in progress.')
  pending.current=true;setBusy(true);setOpen(true);setStatus('Sending your delivery…')
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,125000)
  signal?.addEventListener('abort',abort,{once:true});life.current?.signal.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
  try{
   const result=await deliverFile(candidate,{signal:controller.signal})
   if(result.status==='delivered'){
    const receipt={...result,name:candidate.name,at:Date.now()};try{sessionStorage.setItem('pi-upload-receipt',JSON.stringify(receipt))}catch{}
    window.dispatchEvent(new Event('pi-upload-received'));setStatus('Delivered. Receipt: '+result.receipt);setFile(null);setLetter('')
   }else setStatus(result.message)
   return result
  }catch(error){setStatus(error.name==='AbortError'?'Delivery cancelled or timed out; no receipt confirmed.':error.message);throw error}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);life.current?.signal.removeEventListener('abort',abort);pending.current=false;setBusy(false)}
 }
 const actions=useRef(null)
 actions.current={temperature,upload,selectedFile:()=>fileRef.current,subscribe:()=>{setWatch(true);setOpen(true);return {subscription:'temperature',status:'active',interval_seconds:30,scope:'this visible browser tab'}},unsubscribe:()=>{setWatch(false);return {subscription:'temperature',status:'stopped'}}}
 useEffect(()=>{
  if(!enabled){setConnection('Tools disabled');setWatch(false);return}
  const controller=new AbortController(),context=document.modelContext||navigator.modelContext
  const tools=gatewayTools(Object.fromEntries(['temperature','upload','selectedFile','subscribe','unsubscribe'].map(name=>[name,(...args)=>actions.current[name](...args)])))
  registerGatewayTools(context,tools,controller.signal).then(ok=>{if(!controller.signal.aborted)setConnection(ok?'5 browser tools connected':'Browser WebMCP unavailable — manual controls work')}).catch(()=>{if(!controller.signal.aborted)setConnection('Browser tool registration failed — manual controls work')})
  return()=>controller.abort()
 },[enabled])
 useEffect(()=>{
  if(!watch)return
  const poll=()=>{if(!document.hidden)actions.current.temperature().catch(error=>setStatus(error.message))}
  poll();const timer=setInterval(poll,30000);document.addEventListener('visibilitychange',poll)
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',poll)}
 },[watch])
 useEffect(()=>{if(open)panel.current?.focus()},[open])
 const run=async(fn)=>{try{await fn()}catch(error){setStatus(error.message)}}
 return <aside className="gateway-mcp" aria-label="Gateway browser tools">
  {open&&<section ref={panel} tabIndex="-1" id="gateway-mcp-panel" className="mcp-panel" aria-label="WebMCP controls" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);toggle.current?.focus()}}}>
   <header><span>GATEWAY / WEBMCP</span><button onClick={()=>{setOpen(false);toggle.current?.focus()}} aria-label="Close browser tools">×</button></header>
   <h2>A little cosmic connection.</h2><p className="mcp-connection">{connection}</p>
   <label className="mcp-enable"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable browser tools</label>
   <div className="mcp-temperature"><strong>{reading?.available?reading.celsius.toFixed(1)+' °C':'— °C'}</strong><button onClick={()=>run(()=>temperature())}>Read temperature</button></div>
   <label className="mcp-enable"><input type="checkbox" checked={watch} onChange={e=>setWatch(e.target.checked)}/> Subscribe to live temperature</label>
   <p className="mcp-caption">Updates here every 30 seconds while visible. No external push connection. Prompt templates disabled.</p>
   <label className="mcp-file">Choose a file · 50 MB maximum<input type="file" disabled={busy} onChange={e=>{const item=e.target.files[0];if(item&&(!item.size||item.size>50000000)){setStatus('Choose a file between 1 byte and 50 MB.');setFile(null)}else setFile(item||null)}}/></label>
   <button className="mcp-send" disabled={!file||busy} onClick={()=>run(()=>upload(file))}>Send selected file ↗</button>
   <label className="mcp-letter">A love letter for Matt<textarea value={letter} maxLength={8000} placeholder="Dear Matt…" disabled={busy} onChange={e=>setLetter(e.target.value)}/></label>
   <button className="mcp-send" disabled={!letter.trim()||busy} onClick={()=>run(()=>upload(new File([letter],'love-letter.txt',{type:'text/plain'})))}>Send love letter ♡</button>
   <p className="mcp-caption">Sends to Matt’s private inbox. Upload limits and seven-day retention apply. <a href="/drop/">Open inbox for browser verification.</a></p>
   <p className="mcp-status" role="status">{status}</p>
  </section>}
  <button ref={toggle} className="mcp-orb" aria-label={open?'Close WebMCP tools':'Open WebMCP tools'} aria-expanded={open} aria-controls="gateway-mcp-panel" onClick={()=>setOpen(v=>!v)}><span className="mcp-orbit"/><span className="mcp-core"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m7 23 13-13a6 6 0 0 1 9 9L16 32M11 27 24 14M17 33l4 4M5 20l13-13a6 6 0 0 1 9 0"/></svg><b>MCP</b></span></button>
 </aside>
}
