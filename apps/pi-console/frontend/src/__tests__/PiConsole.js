// Adapted from upstream PaneSmoke.js and Widgets.js: retain real shared UI
// components, replace only the SSH API boundary with deterministic fixtures.
import React from 'react'
import '@testing-library/jest-native/extend-expect'
import { render, screen, fireEvent, waitFor } from 'test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Overview, ServicesView, ServiceDetail, AccessView, NetworkView, TestsView, SettingsView } from '../pi/PiApp'
import { request, serviceState } from '../pi/api'

jest.mock('../pi/api', () => ({ ...jest.requireActual('../pi/api'), request: jest.fn() }))

const services = [
  { id: 'nostr', name: 'Nostr', group: 'Messaging', unit: 'upstream-nostr.service', readiness: 'Configured', notes: 'Relay checks recorded', runtime: { ActiveState: 'active' }, source: 'https://github.com/spr-networks/spr-nostr' },
  { id: 'meshtastic', name: 'Meshtastic', group: 'Radio', unit: null, readiness: 'Needs hardware', notes: 'Connect a radio', runtime: {} }
]
const data = { services, hostname: 'fixture-pi', sampled_at: 1, memory_total: 8e9, memory_available: 6e9, disk_free: 4e11, temperature: 45, uptime: 7200, read_only: true, interfaces: [{ifindex: 2, ifname: 'eth0', operstate: 'UP', addr_info: [{scope: 'global', local: '192.0.2.2', prefixlen: 24}]}], routes: [{dst: 'default', dev: 'eth0', gateway: '192.0.2.1'}] }
const overview = { data, error: '', loading: false, refresh: jest.fn() }
const mount = (element, path = '/admin/home', route = '*') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element}/><Route path="/admin/services/:id" element={<ServiceDetail overview={overview}/>} /></Routes></MemoryRouter>)

beforeEach(() => {
  request.mockReset()
  request.mockImplementation(async path => {
    if (path === 'vpn') return {server: 'https://example.test', read_only: true, nodes: [{id: 1, name: 'Example phone', addresses: ['100.64.0.4'], online: true, user: 'owner'}]}
    if (path === 'tests') return {state: 'Passed', suites: [{name: 'Upstream frontend', state: 'Passed', detail: 'Fixture result'}]}
    if (path === 'provenance') return {commit: 'fixture-revision'}
    if (path.endsWith('/logs')) return {text: 'Relay listening'}
    throw new Error('Unexpected request')
  })
})

test('overview uses live values and distinguishes incomplete setup', () => {
  mount(<Overview overview={overview} />)
  expect(screen.getByText('1 running')).toBeTruthy()
  expect(screen.getByText('1 applications need setup or hardware')).toBeTruthy()
  expect(screen.getByText('Meshtastic')).toBeTruthy()
})

test('search, empty result and group filter work', () => {
  mount(<ServicesView overview={overview} />)
  fireEvent.changeText(screen.getByLabelText('Find a service'), 'Nostr')
  expect(screen.getByText('Nostr')).toBeTruthy()
  expect(screen.queryByText('Meshtastic')).toBeNull()
  fireEvent.changeText(screen.getByLabelText('Find a service'), 'missing')
  expect(screen.getByText('No services match this filter.')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Find a service'), '')
  fireEvent.press(screen.getAllByText('Radio')[0])
  expect(screen.queryByText('Nostr')).toBeNull()
  expect(screen.getByText('Meshtastic')).toBeTruthy()
})

test('service navigation opens details, reads logs and prevents preview mutations', async () => {
  mount(<ServicesView overview={overview} />, '/admin/services', '/admin/services')
  fireEvent.press(screen.getByLabelText('Open Nostr'))
  expect(screen.getByText('Relay checks recorded')).toBeTruthy()
  for (const verb of ['Start', 'Stop', 'Restart']) {
    expect(screen.getByRole('button', {name: verb})).toBeDisabled()
    fireEvent.press(screen.getByRole('button', {name: verb}))
  }
  expect(request).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText('Read logs'))
  await waitFor(() => expect(screen.getByText('Relay listening')).toBeTruthy())
  expect(request).toHaveBeenCalledWith('services/nostr/logs')
})

test('private access lists peers and cannot approve from preview', async () => {
  mount(<AccessView />)
  await waitFor(() => expect(screen.getByText('Example phone')).toBeTruthy())
  fireEvent.changeText(screen.getByLabelText('Phone authentication ID'), 'hskey-authreq-example123456')
  expect(screen.getByRole('button', {name: 'Approve for owner'})).toBeDisabled()
  fireEvent.press(screen.getByText('Approve for owner'))
  expect(request).toHaveBeenCalledTimes(1)
})

test('network shows interfaces and default route', () => {
  mount(<NetworkView overview={overview} />)
  expect(screen.getByText('192.0.2.2/24')).toBeTruthy()
  expect(screen.getByText('eth0 → 192.0.2.1')).toBeTruthy()
})

test('tests page reports recorded coverage', async () => {
  mount(<TestsView />)
  await waitFor(() => expect(screen.getByText('Upstream frontend')).toBeTruthy())
})

test('settings retains upstream theme picker', async () => {
  const onTheme = jest.fn()
  mount(<SettingsView themeKey="default:light" onTheme={onTheme} />)
  await waitFor(() => expect(screen.getByText('Upstream revision fixture-revision')).toBeTruthy())
  const buttons = screen.getAllByRole('button')
  fireEvent.press(buttons[1])
  expect(onTheme).toHaveBeenCalledTimes(1)
})

test('connection failure labels previously loaded values as stale', () => {
  mount(<Overview overview={{...overview, error: 'SSH unavailable'}} />)
  expect(screen.getByText('Connection unavailable')).toBeTruthy()
  expect(screen.getByText('Previously loaded values may be out of date.')).toBeTruthy()
})

test('API errors are shown and refresh recovers', async () => {
  request.mockRejectedValueOnce(new Error('SSH unavailable'))
  mount(<AccessView />)
  await waitFor(() => expect(screen.getByText('SSH unavailable')).toBeTruthy())
  fireEvent.press(screen.getByLabelText('Refresh'))
  await waitFor(() => expect(screen.getByText('Example phone')).toBeTruthy())
  expect(screen.queryByText('SSH unavailable')).toBeNull()
})

test.each([['active','Running'], ['failed','Failed'], ['inactive','Stopped'], ['activating','Starting'], ['unknown','Unknown']])('reports actual runtime %s', (state, label) => {
  expect(serviceState({...services[0], runtime: {ActiveState: state}})).toBe(label)
})
