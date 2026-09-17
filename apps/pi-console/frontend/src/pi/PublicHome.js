import React, { useEffect, useState } from 'react'
import WebMCPWidget from './WebMCPWidget'
import SystemInstruments from './SystemInstruments'
import './metr.css'
import './brand.css'
import {BrandHero,PublicFooter} from './Brand'
export default function PublicHome() {
 const [data,setData]=useState(null),[error,setError]=useState('')
 useEffect(()=>{
  let active=true,pending=false,controller,timer,failures=0
  const poll=async()=>{
   clearTimeout(timer)
   if(pending||document.hidden||!active)return
   pending=true;controller=new AbortController()
   const timeout=setTimeout(()=>controller.abort(),10000)
   try{
    const response=await fetch('/public-api/metrics',{signal:controller.signal})
    if(!response.ok)throw Error('Metrics temporarily unavailable')
    const result=await response.json();failures=0
    if(active){setData(result);setError('')}
   }catch(e){failures=Math.min(failures+1,4);if(active)setError('Connection unavailable')}
   finally{clearTimeout(timeout);pending=false;if(active&&!document.hidden)timer=setTimeout(poll,Math.min(300000,30000*2**failures)+Math.random()*3000)}
  }
  const visibility=()=>{clearTimeout(timer);if(!document.hidden)poll()}
  poll();document.addEventListener('visibilitychange',visibility)
  return()=>{active=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visibility)}
 },[])

 return <div className="metr-ui brand-refresh public-dashboard"><a className="metr-skip" href="#main">Skip to content</a><main id="main" className="metr-container metr-main"><BrandHero/><SystemInstruments publicMode telemetry={data?.telemetry} overview={data?.overview} error={error}/><section id="private-access" className="brand-access-section"><div><span className="metr-eyebrow">CONNECTED, YOUR WAY</span><h2>One address.<br/>Your own space.</h2></div><div><p>At home or away, this is the place to check in on the Pi. This public view shares live system readings, household token gauges, and a small upload inbox.</p><p>On your private Tailscale connection, the same address opens your services, settings and full file browser.</p><a className="metr-button secondary" href="/drop/">Leave a file for Matt <span aria-hidden="true">↗</span></a></div></section><section className="brand-delivery-notes" aria-label="Upload information"><article><span>01</span><h3>A little less friction.</h3><p>Choose a file and send it from your browser. No account needed.</p></article><article><span>02</span><h3>A little more privacy.</h3><p>Uploads go to a separate inbox. Visitors cannot browse or download them.</p></article><article><span>03</span><h3>A sensible boundary.</h3><p>50 MB per file, a quick browser puzzle, and automatic deletion after seven days.</p></article></section></main><PublicFooter/><WebMCPWidget/></div>
}
