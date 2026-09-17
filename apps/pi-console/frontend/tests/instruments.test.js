import React from 'react'
import {render,screen,act,fireEvent} from '@testing-library/react'
import SystemInstruments,{networkRate,networkByteRate} from '../src/pi/SystemInstruments'
import AmberInstruments from '../src/pi/AmberInstruments'
const now=Date.now()/1000
const overview={sampled_at:now,storage:{healthy:true,total:1000,used:820}}
const data={available:true,samples:[{ts:now,cpu:62,memory_percent:71,disk_busy:38,net_rx_bps:1.8e9,net_tx_bps:620e6,temp:49}],meta:{io_sources:{network:'eth1'}}}
test('real system readings populate the supplied LCD arrangement',()=>{
 render(<SystemInstruments telemetry={data} overview={overview}/>);
 expect(screen.getByRole('img',{name:'CPU utilization: 62.0 percent'})).toBeInTheDocument();
 expect(screen.getByRole('article',{name:'RAM usage: 71 percent'})).toBeInTheDocument();
 expect(screen.getByRole('img',{name:'NAS disk busy: 38.0 percent'})).toBeInTheDocument();
 expect(screen.getByRole('img',{name:'Network in: 1.8 Gb/s'})).toBeInTheDocument();
 expect(screen.getByRole('img',{name:'Network out: 620.0 Mb/s'})).toBeInTheDocument();
 expect(screen.getByText('82% FULL')).toBeInTheDocument();
 expect(screen.getByLabelText('CACHE: not reported')).toBeInTheDocument();
})
test('missing and stale readings never appear as zero or healthy lamps',()=>{
 const {container,rerender}=render(<SystemInstruments telemetry={{...data,samples:[{ts:now,cpu:0}]}} overview={overview}/>);
 expect(screen.getByRole('article',{name:'RAM usage: unavailable'})).toBeInTheDocument();
 expect(screen.getByRole('img',{name:'CPU utilization: 0.0 percent'})).toBeInTheDocument();
 rerender(<SystemInstruments telemetry={data} overview={overview} error="offline" overviewError="offline"/>);
 expect(screen.getByRole('article',{name:'CPU utilization: unavailable'})).toBeInTheDocument();
 expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument();
 expect(screen.getByRole('status')).toHaveTextContent('Connection stale');
 expect(container.querySelectorAll('.annunciator.online:not(.run-lamp)')).toHaveLength(0);
 expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(0);
})
test('staleness advances when no request returns',()=>{
 jest.useFakeTimers();render(<SystemInstruments telemetry={data} overview={overview}/>);
 act(()=>jest.advanceTimersByTime(185000));expect(screen.getByRole('status')).toHaveTextContent('Connection stale');jest.useRealTimers();
})
test('network readouts correctly convert counters',()=>{
 expect(networkRate(3200)).toEqual({value:'3.2',unit:'kb/s'});
 expect(networkRate(0)).toEqual({value:'0.0',unit:'kb/s'});
 expect(networkRate(null).value).toBe('—');
 expect(networkByteRate(8e9)).toEqual({value:'1.0',unit:'GB/s'});
 expect(networkByteRate(8e6)).toEqual({value:'1.0',unit:'MB/s'});
 expect(networkByteRate(8000)).toEqual({value:'1.0',unit:'kB/s'});
 expect(networkByteRate(null).value).toBe('—');
})
test('public token mode retains real RAM and offers the real system panel',()=>{
 const {container}=render(<SystemInstruments publicMode telemetry={data} overview={overview}/>);
 expect(container.querySelectorAll('[data-token-gauge]')).toHaveLength(2);
 expect(screen.getByRole('article',{name:'RAM usage: 71 percent'})).toBeInTheDocument();
 expect(screen.getByLabelText('Monthly tokens: 28,000,000,000')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'System',exact:true}));
 expect(container.querySelectorAll('[data-token-gauge]')).toHaveLength(0);
 expect(screen.getByRole('article',{name:'CPU utilization: 62 percent'})).toBeInTheDocument();
 expect(screen.getByText('AMBIENT')).toBeInTheDocument();
})
test('hold freezes readouts and segments together, then resume returns to current data',()=>{
 jest.useFakeTimers();const {container}=render(<SystemInstruments publicMode telemetry={data} overview={overview}/>);
 fireEvent.click(screen.getByRole('button',{name:'Hold displayed readings'}));
 const first=container.querySelector('[data-token-gauge="throughput"]').outerHTML;
 const total=container.querySelector('[data-token-gauge="monthly"]').dataset.value;
 act(()=>jest.advanceTimersByTime(3000));
 expect(container.querySelector('[data-token-gauge="throughput"]').outerHTML).toBe(first);
 expect(container.querySelector('[data-token-gauge="monthly"]').dataset.value).toBe(total);
 fireEvent.click(screen.getByRole('button',{name:'Resume live readings'}));
 expect(Number(container.querySelector('[data-token-gauge="monthly"]').dataset.value)).toBeGreaterThan(Number(total));jest.useRealTimers();
})
test.each([20,30,31.36,40])('updated template LED boundaries track the reading at %s TPS',tps=>{
 const values={tokens:{tps,total:28000001234,spendRate:340},cpu:0,memory:71,capacity:5,io:0,temp:45,ambient:null,network:{value:'1.2',unit:'kB/s'},health:{}};
 const {container}=render(<AmberInstruments values={values} system={false} running onToggle={()=>{}}/>);
 const gauge=container.querySelector('[data-token-gauge="throughput"]');
 const leds=[...gauge.querySelectorAll('[data-fraction]')];
 const lit=leds.reduce((n,led)=>n+Number(led.dataset.fraction),0);
 expect(46+lit*(460-46)/42).toBeCloseTo(Number(gauge.dataset.fillX),10);
 const value=Number(gauge.dataset.value),marks=[{value:0,x:46},...[...gauge.querySelectorAll('[data-tick]')].map(e=>({value:Number(e.dataset.tick),x:Number(e.dataset.x)}))];
 const upper=marks.findIndex(m=>m.value>=value),lo=marks[Math.max(0,upper-1)],hi=marks[upper];
 const x=hi.value===lo.value?lo.x:lo.x+(hi.x-lo.x)*(value-lo.value)/(hi.value-lo.value);
 expect(Number(gauge.dataset.fillX)).toBeCloseTo(x,10);
 const monthly=container.querySelector('[data-meter-fill="monthly"]');
 expect(Number(monthly.getAttribute('width'))/Number(monthly.dataset.extent)).toBeCloseTo(values.tokens.total/40e9,12);
 expect(container.querySelectorAll('svg[preserveAspectRatio="none"]')).toHaveLength(0);
 expect(container.textContent.toLowerCase()).not.toContain('simulated');
});
test('multiple clusters never share SVG clip or gradient IDs',()=>{
 const values={tokens:{tps:30,total:28e9},cpu:null,memory:null,capacity:null,io:null,temp:null,ambient:null,network:{value:'—',unit:'MB/s'},health:{}};
 const {container}=render(<><AmberInstruments values={values} system={false}/><AmberInstruments values={values} system/></>);
 const ids=[...container.querySelectorAll('svg [id]')].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);
})
