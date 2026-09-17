export function temperatureResult(payload,now=Date.now()/1000){
 const telemetry=payload?.telemetry||payload,sample=telemetry?.samples?.slice(-1)[0]
 if(!telemetry?.available||telemetry.stale||!sample?.ts||now-sample.ts>180||!Number.isFinite(sample.temp))return {available:false,message:'Current system temperature is unavailable.'}
 return {available:true,celsius:sample.temp,sampled_at:sample.ts,simulated:false}
}
export async function deliverFile(file,{signal,fetcher=fetch}={}){
 if(!file||!file.size||file.size>50000000)throw Error('Select one file between 1 byte and 50 MB.')
 const response=await fetcher('/drop/upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file,signal})
 if(!response.headers.get('content-type')?.includes('application/json'))return {status:'browser_verification_required',url:'/drop/',message:'Open the protected inbox and complete browser verification, then retry. Nothing has been confirmed delivered.'}
 const result=await response.json()
 if(response.status!==201)throw Error(result.error||'Delivery was not confirmed.')
 if(!/^[a-f0-9]{32}$/.test(result.receipt)||result.bytes!==file.size)throw Error('Invalid receipt. Delivery status is unknown; do not automatically retry.')
 return {status:'delivered',receipt:result.receipt,bytes:result.bytes}
}
export function gatewayTools({temperature,upload,selectedFile,subscribe,unsubscribe}){
 const empty={type:'object',properties:{},additionalProperties:false}
 return [
  {name:'get_system_temperature',description:'Read the Raspberry Pi CPU temperature in Celsius, including sample time and freshness. This is real telemetry, not the joke token gauges.',inputSchema:empty,annotations:{readOnlyHint:true},execute:(_,options={})=>temperature(options.signal)},
  {name:'upload_file',description:'Send text content or the file the user selected in the Gateway widget to Matt’s private write-only inbox. Requires user authorization and Anubis browser verification. Maximum 50 MB; no filesystem paths or URLs accepted.',inputSchema:{type:'object',properties:{file_name:{type:'string',maxLength:180},text_content:{type:'string',maxLength:64000}},additionalProperties:false},annotations:{readOnlyHint:false,consequentialHint:true},execute:async(args={},options={})=>{
   if(args.text_content!==undefined&&(typeof args.text_content!=='string'||args.text_content.length>64000))throw Error('Text content must be at most 64,000 characters.')
   if(args.file_name!==undefined&&(typeof args.file_name!=='string'||!args.file_name||args.file_name.length>180||/[\\/\x00-\x1f]/.test(args.file_name)))throw Error('Use a plain file name, not a path.')
   const file=args.text_content===undefined?selectedFile():new File([args.text_content],args.file_name||'message.txt',{type:'text/plain'})
   return upload(file,options.signal)
  }},
  {name:'send_matt_a_love_letter',description:'Deliver a user-authorized plain-text love letter to Matt’s private inbox. This sends a real message. Anubis, upload quotas, and retention apply. Does not send email or post publicly.',inputSchema:{type:'object',properties:{message:{type:'string',minLength:1,maxLength:8000}},required:['message'],additionalProperties:false},annotations:{readOnlyHint:false,consequentialHint:true},execute:async({message},options={})=>{
   if(typeof message!=='string'||!message.trim()||message.length>8000)throw Error('Write a letter between 1 and 8,000 characters.')
   return upload(new File([message],'love-letter.txt',{type:'text/plain'}),options.signal)
  }},
  {name:'subscribe_system_temperature',description:'Start one in-page live temperature subscription, refreshed every 30 seconds while this tab is visible. Updates appear in the widget; use get_system_temperature to read the latest sample. This is not an external push subscription.',inputSchema:empty,annotations:{readOnlyHint:false},execute:()=>subscribe()},
  {name:'unsubscribe_system_temperature',description:'Stop the in-page temperature subscription.',inputSchema:empty,annotations:{readOnlyHint:false},execute:()=>unsubscribe()}
 ]
}
export async function registerGatewayTools(context,tools,signal){
 if(!context?.registerTool)return false
 const registered=[]
 const cleanup=()=>{for(const name of registered){try{const result=context.unregisterTool?.(name);result?.catch?.(()=>{})}catch{}}}
 signal.addEventListener('abort',cleanup,{once:true})
 try{
  for(const tool of tools){if(signal.aborted)return false;await context.registerTool({...tool,execute:async(...args)=>JSON.stringify(await tool.execute(...args))},{signal});registered.push(tool.name);if(signal.aborted){cleanup();return false}}
  return true
 }catch(error){cleanup();throw error}
}
