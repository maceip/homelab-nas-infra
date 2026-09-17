import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MetrHome, ServiceCollection, MetrServiceDetail, MetrLayout } from '../src/pi/MetrApp'
import { request } from '../src/pi/api'
jest.mock('../src/pi/api', () => ({...jest.requireActual('../src/pi/api'), request:jest.fn()}))
const services = [
 {id:'nostr',name:'Nostr relay',group:'Messaging',unit:'nostr.service',readiness:'Configured',notes:'Private relay notes.',runtime:{ActiveState:'active'},source:'https://example.com'},
 {id:'headscale',name:'Headscale',group:'Networking',unit:'headscale.service',readiness:'Configured',notes:'Phone connections.',runtime:{ActiveState:'active'},protected:true},
 {id:'radio',name:'Meshtastic',group:'Radio',unit:null,readiness:'Needs hardware',notes:'Attach a radio.'},
 {id:'vault',name:'Vaultwarden',group:'Security',unit:'vault.service',readiness:'Needs account',notes:'Configure a vault.',runtime:{ActiveState:'inactive'}}
]
const now=Date.now()/1000
const data={hostname:'test-pi',sampled_at:now,services,read_only:true,storage:{healthy:true,free:2e12,total:4e12,used:2e12},file_browser_url:'http://192.168.0.56:8080/files/',memory_total:8e9,memory_available:6e9,disk_free:30e9,uptime:3600,interfaces:[],routes:[]}
const overview={data,error:'',loading:false,refresh:jest.fn()}
const telemetry={available:true,samples:[{ts:now-30,cpu:4,temp:49}],meta:{sampled_at:now},activity_bins:[],events:[]}
const wrap = element => render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}>{element}</MemoryRouter>)
beforeEach(()=>{jest.clearAllMocks();window.scrollTo=jest.fn();request.mockImplementation(async path => path==='overview' ? data : path==='observability' ? telemetry : path==='vpn' ? {nodes:[],read_only:true} : {suites:[]})})
test('overview uses measured values and preserves embedded live files',async()=>{
 wrap(<MetrHome overview={overview}/>);
 expect(screen.getByText('Connected to test-pi')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Open your files'})).toHaveAttribute('href','/admin/files');
 expect(screen.getByTitle('Shared files dashboard widget')).toHaveAttribute('src',data.file_browser_url);
 expect((await screen.findAllByText('49.0 °C'))[0]).toBeInTheDocument();
})
test('lost connection clearly marks old readings and removes file iframe',async()=>{
 wrap(<MetrHome overview={{...overview,error:'Network unreachable'}}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('Previously loaded values may be out of date');
 expect(screen.queryByTitle('Shared files dashboard widget')).toBeNull();
 expect(screen.getByText('Storage status unavailable')).toBeInTheDocument();
 (await screen.findAllByText('49.0 °C'))[0];
})
test('featured filters and expansion operate on actual service status',()=>{
 wrap(<ServiceCollection services={services} featured/>);
 expect(screen.queryByRole('link',{name:/Vaultwarden/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'View all 4 services'}));
 expect(screen.getByRole('link',{name:/Vaultwarden/})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Running',exact:true}));
 expect(screen.queryByRole('link',{name:/Meshtastic/})).toBeNull();
 expect(screen.getByRole('link',{name:/Nostr relay/})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Needs setup',exact:true}));
 expect(screen.getByRole('link',{name:/Meshtastic/})).toBeInTheDocument();
 expect(screen.queryByRole('link',{name:/Nostr relay/})).toBeNull();
})
test('service search combines with category filters and shows empty result',()=>{
 wrap(<ServiceCollection services={services}/>);
 fireEvent.change(screen.getByRole('searchbox',{name:'Find a service'}),{target:{value:'relay'}});
 expect(screen.getByRole('link',{name:/Nostr relay/})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Radio',exact:true}));
 expect(screen.getByText('No services match this filter.')).toBeInTheDocument();
})
test('service detail keeps mutation disabled and escapes logs',async()=>{
 request.mockResolvedValue({text:'<script>private log text</script>'});
 render(<MemoryRouter initialEntries={['/admin/services/nostr']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Routes><Route path="/admin/services/:id" element={<MetrServiceDetail overview={overview}/>}/></Routes></MemoryRouter>);
 for(const name of ['Start','Stop','Restart']) expect(screen.getByRole('button',{name,exact:true})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Read logs'}));
 expect(await screen.findByText('<script>private log text</script>')).toBeInTheDocument();
 expect(document.querySelector('script')).toBeNull();
 expect(request).toHaveBeenCalledWith('services/nostr/logs');
})
test('protected connectivity actions stay disabled even when server allows control',()=>{
 render(<MemoryRouter initialEntries={['/admin/services/headscale']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Routes><Route path="/admin/services/:id" element={<MetrServiceDetail overview={{...overview,data:{...data,read_only:false}}}/>}/></Routes></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Stop',exact:true})).toBeDisabled();
})
test('navigation bar is removed while footer links still open services',async()=>{
 wrap(<MetrLayout/>);
 await screen.findByText('Connected to test-pi');
 expect(screen.queryByRole('navigation',{name:'Main navigation'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Menu'})).toBeNull();
 fireEvent.click(screen.getByRole('link',{name:'Services',exact:true}));
 expect(await screen.findByRole('searchbox',{name:'Find a service'})).toBeInTheDocument();
 expect(document.documentElement.classList.contains('cockpit-docked')).toBe(false);
})
test('phone approval is disabled when server marks the dashboard read only',async()=>{
 render(<MemoryRouter initialEntries={['/admin/access']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><MetrLayout/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText('Authentication ID from your phone'),{target:{value:'example'}});
 await waitFor(()=>expect(request).toHaveBeenCalledWith('vpn'));
 expect(screen.getByRole('button',{name:'Approve for owner'})).toBeDisabled();
 expect(request).not.toHaveBeenCalledWith('vpn/register',expect.anything());
})
