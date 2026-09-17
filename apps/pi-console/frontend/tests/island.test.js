import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import IslandOverview from '../src/pi/IslandOverview'
import { mountLiquidGlass, supportsLiquidGlass } from '../src/pi/liquidGlass'

jest.mock('../src/pi/Observability', () => () => null)

const data = { hostname:'fixture-pi', services:[{id:'nostr',name:'Nostr',unit:'nostr',runtime:{ActiveState:'active'},readiness:'Configured'},{id:'radio',name:'Radio',unit:null,readiness:'Needs hardware'}],memory_total:8*1073741824,memory_available:6*1073741824,disk_total:200*1073741824,disk_free:100*1073741824,temperature:45,uptime:7200,sampled_at:1,read_only:true }
function mount(overrides = {}) {
  const props = {data,error:'',loading:false,refresh:jest.fn(),...overrides}
  render(<MemoryRouter initialEntries={['/admin/home']}><Routes><Route path="/admin/home" element={<IslandOverview overview={props}/>} /><Route path="/admin/services" element={<p>Service list destination</p>}/><Route path="/admin/services/radio" element={<p>Radio detail destination</p>}/><Route path="/admin/access" element={<p>Private access destination</p>}/></Routes></MemoryRouter>)
  return props
}
afterEach(cleanup)

test('new overview shows real metrics in accessible vendored progress bars', () => {
  mount()
  expect(screen.getByRole('progressbar',{name:'Memory in use'})).toHaveAttribute('aria-valuenow','25')
  expect(screen.getByRole('progressbar',{name:'System disk free'})).toHaveAttribute('aria-valuenow','50')
  expect(screen.getByRole('progressbar',{name:'Running services'})).toHaveAttribute('aria-valuenow','50')
  expect(screen.getByText('2.0 GB')).toBeInTheDocument()
  expect(screen.getByText('1 to set up')).toBeInTheDocument()
})
test('new service button navigates to the retained service list', () => {
  mount(); fireEvent.click(screen.getByRole('button',{name:/Explore your services/}))
  expect(screen.getByText('Service list destination')).toBeInTheDocument()
})
test('setup row navigates to that service detail', () => {
  mount(); fireEvent.click(screen.getByRole('button',{name:'Radio Needs hardware'}))
  expect(screen.getByText('Radio detail destination')).toBeInTheDocument()
})
test('private-access card navigates to enrolled devices', () => {
  mount(); fireEvent.click(screen.getByRole('button',{name:/View connected devices/}))
  expect(screen.getByText('Private access destination')).toBeInTheDocument()
})
test('refresh remains wired to actual resource refresh', () => {
  const props=mount(); fireEvent.click(screen.getByRole('button',{name:'Refresh'}))
  expect(props.refresh).toHaveBeenCalledTimes(1)
})
test('lost connection never becomes a healthy live display', () => {
  mount({error:'SSH unavailable'})
  expect(screen.getByRole('alert')).toHaveTextContent('Previously loaded values may be out of date.')
  expect(screen.getByText('Connection interrupted')).toBeInTheDocument()
  expect(screen.getByText('Last known values')).toBeInTheDocument()
})
test('cold failure gives recovery guidance without inventing metrics', () => {
  mount({data:null,error:'SSH unavailable'})
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Use Refresh to reconnect.')
})
test('failed services remain visible on the decorative overview', () => {
  mount({data:{...data, services:[{...data.services[0],runtime:{ActiveState:'failed'}}]}})
  expect(screen.getByRole('alert')).toHaveTextContent('1 service reporting a failure')
})
test('normal browser uses a complete fallback, without loading experimental renderer', () => {
  const load=jest.fn(); const host=document.createElement('div')
  const release=mountLiquidGlass(host,{env:{navigator:{}},load})
  expect(load).not.toHaveBeenCalled(); expect(host.childElementCount).toBe(0); expect(release).not.toThrow()
})
test('WebGPU alone is insufficient for DOM-backed glass', () => {
  expect(supportsLiquidGlass({navigator:{gpu:{}}})).toBe(false)
  expect(supportsLiquidGlass({navigator:{gpu:{}},GPUQueue:{prototype:{copyElementImageToTexture(){}}}})).toBe(true)
})
test('reduced motion avoids renderer allocation', () => {
  const load=jest.fn()
  mountLiquidGlass(document.createElement('div'),{env:{navigator:{gpu:{}},GPUQueue:{prototype:{copyElementImageToTexture(){}}},matchMedia:()=>({matches:true})},load})
  expect(load).not.toHaveBeenCalled()
})
test('unmount during lazy import never creates a GPU device', async () => {
  let finish
  const requestAdapter=jest.fn()
  const env={navigator:{gpu:{requestAdapter}},GPUQueue:{prototype:{copyElementImageToTexture(){}}},document,cancelAnimationFrame:jest.fn()}
  const release=mountLiquidGlass(document.createElement('div'),{env,load:()=>new Promise(resolve=>{finish=resolve})})
  release(); finish({}); await Promise.resolve()
  expect(requestAdapter).not.toHaveBeenCalled()
})
test('failed renderer import falls back without changing service content', async () => {
  const host=document.createElement('div'); host.innerHTML='<span>service data</span>'
  const env={navigator:{gpu:{}},GPUQueue:{prototype:{copyElementImageToTexture(){}}},document,cancelAnimationFrame:jest.fn()}
  mountLiquidGlass(host,{env,load:()=>Promise.reject(new Error('offline'))}); await Promise.resolve(); await Promise.resolve()
  expect(host.dataset.glass).toBe('fallback'); expect(host).toHaveTextContent('service data')
})
