import {useEffect} from 'react'
// Follow reflows while bottom-pinned, but let visitors scroll the content freely.
export default function useBottomDock(){
 useEffect(()=>{
  document.documentElement.classList.add('cockpit-docked')
  let frame,disposed=false,pinned=true,mobile=window.innerWidth<=700
  const geometry=()=>[document.documentElement.scrollHeight,window.innerHeight]
  let previous=geometry()
  const align=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(disposed)return
   const nextMobile=window.innerWidth<=700
   if(nextMobile&&!mobile)pinned=true
   mobile=nextMobile
   if(mobile&&pinned)window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})
   previous=geometry()
  })}
  const scroll=()=>{
   const current=geometry()
   if(current[0]!==previous[0]||current[1]!==previous[1]){align();return}
   pinned=current[0]-window.scrollY-current[1]<=4
  }
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(align)
  observer?.observe(document.body)
  window.addEventListener('scroll',scroll,{passive:true})
  window.addEventListener('resize',align)
  window.addEventListener('load',align)
  window.visualViewport?.addEventListener('resize',align)
  document.fonts?.ready.then(()=>{if(!disposed)align()})
  align()
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('scroll',scroll);window.removeEventListener('resize',align);window.removeEventListener('load',align);window.visualViewport?.removeEventListener('resize',align);document.documentElement.classList.remove('cockpit-docked')}
 },[])
}
