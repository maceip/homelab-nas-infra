import {useEffect,useState} from 'react'
export const INITIAL_TOKENS=28000000000
export function stepJokeTokens(previous,seconds,random=Math.random){
 const tps=20+Math.max(0,Math.min(1,random()))*20
 const spendRate=280+Math.max(0,Math.min(1,random()))*120
 return {tps,spendRate,total:previous.total+Math.max(0,seconds)*spendRate}
}
export default function useJokeTokens(enabled){
 const [state,setState]=useState({tps:30,spendRate:340,total:INITIAL_TOKENS})
 useEffect(()=>{
  if(!enabled)return
  let last=performance.now()
  const tick=()=>{const now=performance.now(),seconds=(now-last)/1000;last=now;setState(s=>stepJokeTokens(s,seconds))}
  const timer=setInterval(tick,1000)
  return()=>clearInterval(timer)
 },[enabled])
 return enabled?state:null
}
