import React,{useEffect,useState} from 'react'
const KEY='pi-upload-receipt'
export function takeReceipt(){
 let value
 try {const saved=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);if(saved)value=JSON.parse(saved)} catch {}
 const match=window.location.hash.match(/^#upload-receipt=([a-f0-9]{32})$/)
 if(match){value=value||{receipt:match[1]};window.history.replaceState(null,'',window.location.pathname+window.location.search)}
 return value&&/^[a-f0-9]{32}$/.test(value.receipt)&&(!value.at||Date.now()-value.at<3600000)?{...value,name:typeof value.name==='string'?value.name.slice(0,180):''}:null
}
export default function ReceiptToast(){
 const [receipt,setReceipt]=useState(null),[copied,setCopied]=useState(false),[failed,setFailed]=useState(false)
 useEffect(()=>{const receive=()=>{setReceipt(takeReceipt());setCopied(false);setFailed(false)};receive();window.addEventListener('pi-upload-received',receive);return()=>window.removeEventListener('pi-upload-received',receive)},[])
 if(!receipt)return null
 const copy=async()=>{try{await navigator.clipboard.writeText(receipt.receipt);setCopied(true);setFailed(false)}catch{setFailed(true)}}
 return <aside className="receipt-toast" aria-label="Upload receipt"><div className="receipt-top"><span className="receipt-check" aria-hidden="true">✓</span><div role="status"><strong>File delivered.</strong><p>Your receipt is ready.</p></div><button className="receipt-dismiss" aria-label="Dismiss upload receipt" onClick={()=>setReceipt(null)}>×</button></div>{receipt.name&&<p className="receipt-filename">{receipt.name}</p>}<div className="receipt-code"><code tabIndex="0">{receipt.receipt}</code><button onClick={copy} aria-label={copied?'Receipt copied':'Copy receipt'} title="Copy receipt"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></button></div><p className="receipt-help" role="status">{failed?'Select the receipt above and copy it manually.':copied?'Copied to clipboard.':'Keep this receipt for your records.'}</p></aside>
}
