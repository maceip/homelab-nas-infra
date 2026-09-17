import React from 'react'
import { render, screen } from '@testing-library/react'
import { ObservabilityPanel, SharedFilesWidget, Trend } from '../src/pi/Observability'

const now=Date.now()/1000
const data={available:true,stale:false,samples:[{ts:now-40,cpu:12.5,temp:50}],activity_bins:[{ts:now-300,count:3}],events:[],meta:{sampled_at:now},counts:{web_probe:20},rules:'Five failures trigger review.'}
test('real metrics and review signal count appear beside each other',()=>{
 render(<ObservabilityPanel data={data}/>);
 expect(screen.getByText('12.5%')).toBeInTheDocument();expect(screen.getByText('50.0 °C')).toBeInTheDocument();
 expect(screen.getByRole('img',{name:'3 activity review signals in five-minute bins over 24 hours'})).toBeInTheDocument();
 expect(screen.getByText(/20 sensitive-path requests/)).toBeInTheDocument();
})
test('missing or stale telemetry never reports a healthy network',()=>{
 const {rerender}=render(<ObservabilityPanel data={{available:false,reason:'Collector unavailable'}}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Collector unavailable');
 expect(screen.getByRole('img',{name:'Activity data unavailable'})).toBeInTheDocument();
 rerender(<ObservabilityPanel data={{...data,stale:true}}/>);
 expect(screen.getByRole('status')).toHaveTextContent('stale');
})
test('router delivery is shown as overdue and log text is escaped',()=>{
 render(<ObservabilityPanel data={{...data,meta:{router_received_at:now-8000,router_excerpt:'<script>bad()</script>'}}}/>);
 expect(screen.getByText('Delivery overdue')).toBeInTheDocument();expect(screen.getByText('<script>bad()</script>')).toBeInTheDocument();expect(document.querySelector('script')).toBeNull();
})
test('storage failure removes embedded file access',()=>{
 const overview={data:{storage:{healthy:true},file_browser_url:'http://100.64.0.1:8080/files/'}};
 const {rerender}=render(<SharedFilesWidget overview={overview}/>);
 expect(screen.getByTitle('Shared files dashboard widget')).toHaveAttribute('src','http://100.64.0.1:8080/files/');
 rerender(<SharedFilesWidget overview={{...overview,error:'Offline'}}/>);
 expect(screen.queryByTitle('Shared files dashboard widget')).not.toBeInTheDocument();
})
test('metric graph does not connect across missing samples or outages',()=>{
 const {container}=render(<Trend samples={[{ts:now-600,cpu:10},{ts:now-570,cpu:11},{ts:now-100,cpu:15},{ts:now-70,cpu:null},{ts:now-40,cpu:12}]} field="cpu" label="test graph" end={now}/>);
 const path=container.querySelector('.obs-line').getAttribute('d');
 expect((path.match(/M/g)||[])).toHaveLength(3);expect((path.match(/L/g)||[])).toHaveLength(1);
})
