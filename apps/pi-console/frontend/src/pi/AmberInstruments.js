import React, {useId} from 'react'
import {BrandMark} from './Brand'
import './amber-instruments.css'

// Geometry and seven-segment polygons are ported from the supplied designer source.
const digitMap={'0':[0,1,2,3,4,5],'1':[1,2],'2':[0,1,6,4,3],'3':[0,1,6,2,3],'4':[5,6,1,2],'5':[0,5,6,2,3],'6':[0,5,6,4,2,3],'7':[0,1,2],'8':[0,1,2,3,4,5,6],'9':[0,1,2,3,5,6],'—':[6]}
const segments=['11,2 43,2 50,9 42,16 13,16 6,9','43,16 51,9 51,42 44,49 37,42 37,22','44,51 51,58 51,87 44,94 37,87 37,58','13,84 42,84 49,91 42,98 11,98 4,91','3,58 10,51 17,58 17,84 10,91 3,84','3,9 10,16 17,22 17,42 10,49 3,42','13,43 41,43 48,50 41,57 13,57 6,50']
const finite=Number.isFinite
const display=(value,places=0)=>finite(value)?value.toFixed(places):'—'
export function Digits({value,className=''}){
 let width=0
 const characters=String(value).split('').map((character,index)=>{const x=width;width+=character==='.'?16:58;return character==='.'?<rect key={index} x={x+2} y="85" width="12" height="12" rx="1" className="digit-on"/>:<g key={index} transform={`translate(${x},0)`}>{segments.map((points,i)=><polygon key={i} points={points} className={digitMap[character]?.includes(i)?'digit-on':'digit-off'}/>)}</g>})
 return <svg className={`digits ${className}`} viewBox={`0 0 ${width} 100`} style={{width:`${width/100}em`}} aria-hidden="true">{characters}</svg>
}
function Icon({kind}){
 const paths={sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,arrow:<path d="M3 12h18m-7-7 7 7-7 7"/>,disk:<><path d="M3 10h10l3 4 5-4v8h-5l-3 2H5L2 13zM6 7h7M9 7v3M2 7l3 3"/><path d="M20 3c-3 4-3 5-1 5s2-2 1-5Z" fill="currentColor" stroke="none"/></>,monthly:<><path d="M3 6h18v14H3zM6 3v3m12-3v3M6 12h4m5 0h4m-2-2v4"/></>,temperature:<><path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 7v10"/></>,network:<><path d="M4 21V3h10v18M2 21h14M6 5h6v7H6zM14 12h2a2 2 0 0 1 2 2v4a2 2 0 0 0 4 0V9l-4-4M19 6v5h3"/></>,io:<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,cpu:<><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></>}
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]||paths.network}</svg>
}
function MeterGraphic({
  kind,
  value,
  max
}) {
  const id = `meter-${kind}-${useId().replace(/:/g, "")}`;
  const extent=kind==="disk"?191:kind==="temperature"?244:kind==="network"?244:183;
  const ratio=finite(value)?Math.max(0,Math.min(1,value/max)):0;
  const fillWidth = ratio===0?0:3+(extent-3)*ratio;
  let blocks, rails;
  if (kind === "disk") {
    blocks = [{
      path: "M3 53 Q20 28 47 22 L47 42 Q32 43 25 53Z",
      scores: [3, 47]
    }, ...[51, 99, 147].map(x => ({
      path: `M${x} 22h44v22h-44Z`,
      scores: [x, x + 44]
    }))];
    rails = [51, 99, 147, 195].map(x => ({
      path: `M${x} 12h44v5h-44Z`
    }));
  } else if (kind === "temperature") {
    blocks = [{
      path: "M3 43 Q17 24 36 17 L36 45 Q18 50 3 53Z",
      tone: "green",
      scores: [3, 36]
    }, ...[40, 80, 120, 160].map(x => ({
      path: `M${x} 10h35v35h-35Z`,
      scores: [x, x + 35]
    })), {
      path: "M200 10 Q223 10 237 0 L244 0 L244 27 Q225 45 200 45Z",
      tone: "red"
    }];
    rails = [];
  } else if (kind === "network") {
    blocks = [{
      path: "M3 53H22V50L244 17V66H3Z"
    }];
    // Four separate, collinear strokes: the original fuel gauge's fine rising rail.
    rails = Array.from({
      length: 4
    }, (_, i) => {
      const x = 3 + i * 61,
        y = 44 - i * 9;
      return {
        path: `M${x} ${y}l56 -8.262v5l-56 8.262Z`
      };
    });
  } else {
    blocks = [[3, 27], [34, 28], [67, 56], [128, 55]].map(([x, width]) => ({
      path: `M${x} 22h${width}v21h-${width}Z`,
      scores: [x, x + width]
    }));
    rails = [{
      path: "M3 11h59v5H3Z",
      tone: "red"
    }, {
      path: "M67 11h56v5H67Z"
    }];
  }
  const shapes = blocks.map(({
    path,
    tone
  }, i) => <path key={i} d={path} className={`meter-block lcd-${tone ?? "amber"}`} />);
  return <svg className="mini-track" viewBox="0 0 250 70" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
    <defs>
      <clipPath id={`${id}-profile`}>{blocks.map(({
          path
        }, i) => <path key={i} d={path} />)}</clipPath>
      <clipPath id={`${id}-lit`}><rect data-meter-fill={kind} data-value={finite(value)?value:undefined} data-max={max} data-extent={extent} width={fillWidth} height="70" /></clipPath>
    </defs>
    <g className="meter-body">{shapes}</g>
    <g className="meter-illumination"><g className="meter-lit" clipPath={`url(#${id}-lit)`}>{shapes}</g></g>
    <g className="meter-scoring" clipPath={`url(#${id}-profile)`}>
      {blocks.flatMap(({
        scores
      }, block) => scores ? Array.from({
        length: 4
      }, (_, tick) => {
        const x = scores[0] + (scores[1] - scores[0]) * (tick + 1) / 5;
        return <path key={`${block}-${tick}`} d={`M${x} 0v70`} />;
      }) : [])}
      {kind==="network"&&Array.from({length:24},(_,i)=><path key={`network-${i}`} d={`M${3+(i+1)*10} 0v70`}/>)}
    </g>
    {rails.map(({
      path,
      tone
    }, i) => <path key={i} d={path} className={`meter-rail lcd-${tone ?? "amber"}`} />)}
    {kind === "temperature" && <path className="meter-channel" d="M1 40 Q16 22 36 18 L200 18 Q226 18 245 1" />}
    {(kind === "monthly" || kind === "io") && <g className="meter-scale">{[["0", 3], [String(max/2), 93], [String(max), 183]].map(([text, x]) => <text key={text} x={x} y="65" textAnchor="middle">{text}</text>)}</g>}
  </svg>;
}
function MiniMeter({
  kind,
  label,
  value,
  max,
  unit, places=0, gaugeKind, exactValue
}) {
  const shown=finite(value)?Number(value.toFixed(places)):null;
  const measured=gaugeKind==="monthly"?exactValue/1e9:shown;
  return <article className={`mini-meter ${kind}`} aria-label={`${label}: ${finite(value)?display(value,places)+" "+unit:"unavailable"}`} data-token-gauge={gaugeKind} data-value={gaugeKind==="monthly"?exactValue:shown} data-scale-max={gaugeKind==="monthly"?40e9:max}>
    <div className="meter-icon" aria-hidden="true"><Icon kind={kind} /></div>
    <div className="mini-body"><div className="meter-label"><h2>{label}</h2><span>{display(value,places)}<small>{unit}</small></span></div>
      <MeterGraphic kind={kind} value={measured} max={max} />
    </div>
  </article>;
}
function RevMeter({
  value,
  system
}) {
  value=finite(value)?Number(value.toFixed(1)):null;
  // The resting LCD is a continuous olive ribbon. Only illuminated cells show scoring.
  const max = system ? 100 : 70,
    count = 42,
    start = 46,
    end = 460,
    step = (end - start) / count;
  const marks = system ? [{
    value: 0,
    x: 73,
    y: 439
  }, {
    value: 20,
    x: 160,
    y: 367
  }, {
    value: 40,
    x: 247,
    y: 269
  }, {
    value: 60,
    x: 321,
    y: 184
  }, {
    value: 80,
    x: 371,
    y: 180
  }, {
    value: 100,
    x: 454,
    y: 230
  }] : [{
    value: 5,
    x: 73,
    y: 439
  }, {
    value: 10,
    x: 103,
    y: 421
  }, {
    value: 20,
    x: 161,
    y: 367
  }, {
    value: 30,
    x: 219,
    y: 308
  }, {
    value: 40,
    x: 279,
    y: 226
  }, {
    value: 50,
    x: 338,
    y: 166
  }, {
    value: 60,
    x: 393,
    y: 191
  }, {
    value: 70,
    x: 454,
    y: 230
  }];
  const anchors = [{
    value: 0,
    x: start
  }, ...marks.filter(mark => mark.value > 0), {
    value: max,
    x: end
  }];
  const bounded = finite(value)?Math.max(0, Math.min(max, value)):0;
  const upper = anchors.findIndex(mark => mark.value >= bounded);
  const low = anchors[Math.max(0, upper - 1)],
    high = anchors[Math.max(0, upper)];
  const fillX = bounded >= max ? end : high.value === low.value ? low.x : low.x + (high.x - low.x) * (bounded - low.value) / (high.value - low.value);
  const lit = Math.max(0, Math.min(count, (fillX - start) / step));
  const id = `rising-band-${useId().replace(/:/g, "")}`;
  const path = "M46 460 C116 454 180 391 247 304 C281 261 311 216 329 190 C340 174 357 174 371 193 C394 223 419 240 460 246 L460 294 C421 288 394 276 368 253 C356 240 343 243 332 257 C302 295 274 334 239 373 C174 447 106 498 46 507Z";
  return <article className="rev-window glass" aria-label={`${system ? "CPU utilization" : "Tokens per second"}: ${finite(value)?value+(system?" percent":" tokens per second"):"unavailable"}`} data-gauge={system?"cpu":"tokens"} data-token-gauge={system?undefined:"throughput"} data-value={value} data-scale-max={max} data-fill-x={fillX}>
    <svg className="rev-display" viewBox="20 100 454 425" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><clipPath id={id}><path d={path} /></clipPath></defs>
      <path d={path} className="rev-resting-band" />
      <g className="rev-illumination"><g clipPath={`url(#${id})`}>{Array.from({
          length: count
        }, (_, i) => <rect key={i} x={start + i * step} y="170" width={(step-.85)*Math.max(0,Math.min(1,lit-i))} height="340" data-fraction={Math.max(0,Math.min(1,lit-i))} data-active={i<lit?"true":"false"} className={`rev-cell ${i < lit ? "is-lit" : ""}`} />)}</g></g>
      <g className="rev-scoring" clipPath={`url(#${id})`}>{Array.from({length:Math.max(0,Math.ceil(lit)-1)},(_,i)=><path key={i} d={`M${start+(i+1)*step-.45} 170v340`}/>)}</g>
      {marks.map(({
        value: mark,
        x,
        y
      }) => {
        const digits = String(mark),
          scale = .38,
          labelX = Math.min(x, mark === 100 ? 430 : 438);
        return <g key={mark} className="rev-scale-mark" data-tick={mark} data-x={x}>
          <g className="rev-scale-numerals" transform={`translate(${labelX - digits.length * 58 * scale / 2 + 4} ${y - (mark === 30 && !system ? 30 : 21) - 38}) scale(${scale}) skewX(-7)`}>
            {digits.split("").map((digit, index) => <g key={index} transform={`translate(${index * 58} 0)`}>{digitMap[digit].map(segment => <polygon key={segment} points={segments[segment]} />)}</g>)}
          </g>
          <circle cx={x} cy={y} r="4.4" />
        </g>;
      })}
      <g className="rev-legend"><text x="74" y="151">{system ? "CPU LOAD" : "TOKENS"}</text><text className="rev-legend-unit" x="74" y="176">{system ? "PERCENT" : "PER SECOND"}</text></g>
    </svg>
    <h2 className="sr-only">{system ? "CPU load" : "Tokens per second"}</h2>
    <div className="rev-value"><Digits value={display(value,1)} /><span>{system ? "% UTILIZATION" : "TOK / SEC"}</span></div>
  </article>;
}
function ServiceStrip({side,health,running,network}){
 const entries=side==='left'?[['run','RUN','sun'],['api','API','network'],['database','DB','io']]:[['net','NET','arrow'],['cache','CACHE','monthly'],['queue','QUEUE','cpu']]
 const status={...health,run:running,net:finite(network)?network>0:null}
 return <div className={'service-strip '+side} aria-label="Service reporting status">{entries.map(([key,label,kind])=><div key={key} className={'annunciator '+(status[key]===true?'online':status[key]===false?'standby':'standby')+' '+(key==='run'?'run-lamp':key==='api'?'api-lamp':'')} aria-label={label+': '+(status[key]===true?'reporting':status[key]===false?'inactive':'not reported')}><Icon kind={kind}/><span>{label}</span></div>)}{[0,1,2].map(i=><div key={i} className="blank-lamp" aria-hidden="true"/>)}</div>
}
function Odometer({value}){
  const alphabet=" ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-";
  return <div className="model-odometer" aria-label={value}>
    {value.split("").map((character,index)=>{
      const at=Math.max(0,alphabet.indexOf(character));
      return <span key={index} className={`odometer-wheel ${character===" "?"word-gap":""}`} aria-hidden="true" style={{"--drum-offset":`${[-.06,.035,-.025,.07,-.04][index%5]}cqw`,"--roll-delay":`${index*.045}s`,"--roll-duration":`${1.2+(index%4)*.13}s`}}>
        <span className="drum-strip">{Array.from({length:9},(_,row)=><span key={row} className={row===4?"drum-current":"drum-neighbor"}>{alphabet[(at+row-4+alphabet.length)%alphabet.length]||"\u00a0"}</span>)}</span>
      </span>;
    })}
  </div>;
}

export default function AmberInstruments({values:v,system,running,onToggle}){
 const tokens=v.tokens,network=Number(v.network.value),networkMax=finite(network)&&network>0?Math.max(10,10**Math.ceil(Math.log10(network))):10
 return <section className="instrument-cluster" data-running={running} aria-label="Amber LCD performance instrument cluster"><div className="instrument-row">
  <div className="aux-window glass"><MiniMeter kind="disk" label="DISK" value={v.capacity} max={100} unit="%"/><MiniMeter kind={system?'io':'monthly'} label={system?'DISK I/O':'TOK / MONTH'} value={system?v.io:tokens?.total/1e9} max={system?100:40} unit={system?'%':'B'} places={system?1:0} gaugeKind={system?undefined:'monthly'} exactValue={tokens?Math.floor(tokens.total):undefined}/><MiniMeter kind="temperature" label="CPU TEMP" value={v.temp} max={100} unit="°C" places={1}/><MiniMeter kind="network" label="NETWORK" value={network} max={networkMax} unit={v.network.unit} places={1}/></div>
  <div className="centre-console"><article className="ram-window glass" aria-label={`RAM usage: ${finite(v.memory)?Math.round(v.memory)+' percent':'unavailable'}`}><h2>RAM USAGE</h2><div className="ram-value"><Digits value={finite(v.memory)?String(Math.round(v.memory)).padStart(3,'0'):'—'}/><span>%</span></div></article><div className="console-signature">GATEWAY ELECTRONICS</div><div className="odometer-row"><article className="model-console"><h2>MODEL</h2><div className="alpha-display token-odometer"><Odometer value="Qwen4Exp"/></div>{!system&&<span className="sr-only" aria-label={`Monthly tokens: ${Math.floor(tokens?.total).toLocaleString('en-US')}`}/>}</article><article className="small-console"><h2>{system?'AMBIENT':'CPU'}</h2><div className="small-display"><Digits value={display(system?v.ambient:v.cpu,system?1:0)}/><span>{system?'°C':'%'}</span></div></article></div></div>
  <RevMeter value={system?v.cpu:tokens?.tps} system={system}/>
 </div><div className="lower-console"><ServiceStrip side="left" health={v.health} running={running} network={network}/><div className="mode-knob"><span className={running?'selected':''}>RUN</span><button className={`knob ${running?'running':''}`} onClick={onToggle} aria-label={running?'Hold displayed readings':'Resume live readings'} aria-pressed={!running} title={running?'Hold displayed readings':'Resume live readings'}><BrandMark/></button><span className={!running?'selected':''}>HOLD</span></div><ServiceStrip side="right" health={v.health} running={running} network={network}/></div></section>
}
