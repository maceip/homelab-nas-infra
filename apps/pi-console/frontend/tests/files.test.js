import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import FilesView, { StorageWarning } from '../src/pi/FilesView'
const overview = (storage, error = '') => ({data: {storage}, error, refresh: jest.fn()})
const healthy = {healthy: true, used: 10, total: 100, free: 90, sampled_at: 100, downloads_paused: true}
test('embeds files with live editing disclosure', () => {
  const state = overview(healthy)
  render(<FilesView overview={state}/> )
  expect(screen.getByTitle('Shared files on the Pi')).toHaveAttribute('src', 'http://192.168.0.56:8080/files/')
  expect(screen.getByText(/File changes are live/)).toBeInTheDocument()
  expect(screen.getByText(/downloads are paused/)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Refresh'))
  expect(state.refresh).toHaveBeenCalledTimes(1)
})
test('storage failure removes frame and explains error', () => {
  render(<FilesView overview={overview({healthy: false, message: 'Input/output error'})}/> )
  expect(screen.queryByTitle('Shared files on the Pi')).not.toBeInTheDocument()
  expect(screen.getByText('Input/output error')).toBeInTheDocument()
})
test('connection failure does not present cached health as current', () => {
  render(<FilesView overview={overview(healthy, 'SSH unavailable')}/> )
  expect(screen.queryByTitle('Shared files on the Pi')).not.toBeInTheDocument()
  expect(screen.getByText('Connection unavailable')).toBeInTheDocument()
})
test('global warning covers failed and stale health', () => {
  const {rerender} = render(<StorageWarning overview={overview({healthy:false,message:'I/O error'})}/> )
  expect(screen.getByRole('alert')).toHaveTextContent('Storage needs attention')
  rerender(<StorageWarning overview={overview(healthy, 'disconnected')}/> )
  expect(screen.getByRole('alert')).toHaveTextContent('Storage status unavailable')
  rerender(<StorageWarning overview={overview(healthy)}/> )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
test('deployed files use the private address instead of the home LAN', () => {
  const state = overview(healthy)
  state.data.deployed = true
  state.data.file_browser_url = 'http://100.64.0.1:8080/files/'
  render(<FilesView overview={state}/> )
  expect(screen.getByTitle('Shared files on the Pi')).toHaveAttribute('src','http://100.64.0.1:8080/files/')
  expect(screen.getByText(/Keep Tailscale connected/)).toBeInTheDocument()
})
