let sessionPromise
async function fetchJSON(url, options={}) {
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),12000)
  try {
    const response=await fetch(url,{credentials:'same-origin',...options,signal:controller.signal})
    let result
    try { result=await response.json() } catch { throw new Error('The dashboard returned an unreadable response.') }
    return {response,result}
  } catch(e) { if(e.name==='AbortError')throw new Error('The Pi took too long to respond. Please retry.');throw e }
  finally { clearTimeout(timeout) }
}
export const session=()=>{
  if(!sessionPromise)sessionPromise=fetchJSON('/pi-api/session').then(({response,result})=>{if(!response.ok)throw new Error('Unable to open the dashboard session.');return result}).catch(e=>{sessionPromise=undefined;throw e})
  return sessionPromise
}
export async function request(path,body,retry=true) {
  const s=await session()
  const {response,result}=await fetchJSON('/pi-api/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Pi-CSRF':s.csrf},body:JSON.stringify(body)})
  if(!response.ok){
    if(response.status===401){sessionPromise=undefined;if(body===undefined&&retry)return request(path,undefined,false)}
    throw new Error(result.error||'The request failed.')
  }
  return result
}

export const serviceState = service => {
  if (!service.unit) return 'On demand'
  const runtime = service.runtime || {}
  if (runtime.LoadState === 'not-found') return 'Not configured'
  if (runtime.ActiveState === 'active') return 'Running'
  if (runtime.ActiveState === 'failed') return 'Failed'
  if (runtime.ActiveState === 'activating') return 'Starting'
  if (runtime.ActiveState === 'inactive') return 'Stopped'
  return 'Unknown'
}
export const needsSetup = service => /needs|partly|isolated|not selected|requires/i.test(service.readiness)
export const formatBytes = number => {
  if (!Number.isFinite(number)) return 'Unavailable'
  if (number >= 1073741824) return (number / 1073741824).toFixed(1) + ' GB'
  return (number / 1048576).toFixed(0) + ' MB'
}
