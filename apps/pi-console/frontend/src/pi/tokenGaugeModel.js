// The same displayed value, scale and LED fraction drive both responsive layouts.
export const TOKEN_SCALES={throughput:{max:50,unit:'TPS'},monthly:{max:40000000000,unit:'B'}}
export function tokenGaugeModel(tokens,kind){
 const scale=TOKEN_SCALES[kind]
 const value=kind==='throughput'?Number(tokens.tps.toFixed(1)):Math.floor(tokens.total)
 return {value,max:scale.max,percent:Math.max(0,Math.min(100,value/scale.max*100)),display:kind==='throughput'?value.toFixed(1):(value/1e9).toFixed(0)+'B',ticks:[0,.2,.4,.6,.8,1].map(f=>({fraction:f,label:kind==='throughput'?f*scale.max:f*scale.max/1e9}))}
}
export function ledFractions(percent,count=20){
 const lit=Number.isFinite(percent)?Math.max(0,Math.min(100,percent))/100*count:0
 return Array.from({length:count},(_,i)=>Math.max(0,Math.min(1,lit-i)))
}
export function gaugeGeometry(mobile){
 return mobile?{top:317,bottom:743,outer:[[317,391],[333,308],[343,249],[353,232],[373,209],[393,191],[413,177],[433,163],[453,153],[473,143],[493,137],[513,129],[533,121],[553,118],[573,115],[623,113],[683,110],[743,110]]}:{top:359,bottom:750,outer:[[359,394],[363,336],[373,309],[393,276],[403,264],[423,242],[443,223],[463,208],[483,194],[503,182],[523,172],[543,163],[563,156],[583,149],[603,143],[623,138],[643,134],[663,131],[683,128],[703,127],[723,126],[750,125]]}
}
export function gaugeTick(mobile,fraction){
 const {top,bottom,outer}=gaugeGeometry(mobile),y=bottom-(bottom-top)*fraction
 const upper=outer.findIndex(([py])=>py>=y)
 if(upper<=0)return {x:outer[0][1],y}
 const [y0,x0]=outer[upper-1],[y1,x1]=outer[upper]
 return {x:x0+(x1-x0)*(y-y0)/(y1-y0),y}
}
