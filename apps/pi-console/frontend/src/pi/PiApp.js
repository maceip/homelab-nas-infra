// Standalone Pi adaptation of SPR's App.web.js and Admin layout.
// The upstream sidebar, theme engine, configuration, list and stat components
// are reused directly. Runtime operations use the local Pi adapter only.
import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  GluestackUIProvider, Box, VStack, HStack, Heading, Text, Button, ButtonText,
  ButtonIcon, Input, InputField, Badge, BadgeText, Spinner, Pressable, Divider,
  Link, LinkText, ScrollView, useColorMode
} from '@gluestack-ui/themed'
import { Theme } from '@gluestack-style/react'
import { Home, Server, Network, ShieldCheck, FlaskConical, Settings, Menu, RefreshCw, Cpu, HardDrive, MemoryStick, ArrowLeft, ExternalLink } from 'lucide-react-native'
import Sidebar from 'components/Sidebar/Sidebar'
import StatsWidget from 'components/Dashboard/StatsWidget'
import { ListHeader, ListItem } from 'components/List'
import { config } from 'gluestack-ui.config'
import { themes, themeList, themeFontCss } from 'Themes'
import { AppContext } from 'AppContext'
import FilesView, { StorageWarning } from './FilesView'
import { request, serviceState, needsSetup, formatBytes } from './api'

export const piRoutes = [
  { name: 'Overview', path: 'home', icon: Home, layout: 'admin' },
  { name: 'Files & storage', path: 'files', icon: HardDrive, layout: 'admin' },
  { name: 'Services', path: 'services', icon: Server, layout: 'admin' },
  { name: 'Private access', path: 'access', icon: ShieldCheck, layout: 'admin' },
  { name: 'Network', hideSimple: true, path: 'network', icon: Network, layout: 'admin' },
  { name: 'Tests', hideSimple: true, path: 'tests', icon: FlaskConical, layout: 'admin' },
  { name: 'Settings', path: 'settings', icon: Settings, layout: 'admin' }
]

export function useResource(path, interval = 0) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let alive = true
    const update = async () => {
      try {
        const value = await request(path)
        if (alive) { setData(value); setError('') }
      } catch (e) { if (alive) setError(e.message) }
      finally { if (alive) setLoading(false) }
    }
    setLoading(true)
    update()
    const timer = interval ? setInterval(update, interval) : null
    return () => { alive = false; if (timer) clearInterval(timer) }
  }, [path, interval, revision])
  return { data, error, loading, refresh: () => setRevision(v => v + 1) }
}

const Panel = ({ children, ...props }) => <Box testID="pi-panel" bg="$backgroundCardLight" sx={{ _dark: { bg: '$backgroundCardDark' } }} borderRadius={10} overflow="hidden" {...props}>{children}</Box>
const Status = ({ children, good = false, bad = false, alignSelf = 'flex-start' }) => <Badge action={bad ? 'error' : good ? 'success' : 'muted'} borderRadius="$full" alignSelf={alignSelf}><BadgeText sx={{ _dark: { color: bad ? '$error300' : good ? '$success300' : '$muted200' } }}>{children}</BadgeText></Badge>
const PageTitle = ({ title, description, children }) => <HStack justifyContent="space-between" flexWrap="wrap" gap="$3" alignItems="center" mb="$5"><VStack space="xs" flex={1}><Heading size="2xl">{title}</Heading><Text size="sm" color="$muted500" dataSet={{ muted: true }}>{description}</Text></VStack>{children}</HStack>
const ErrorMessage = ({ error }) => error ? <Panel p="$4" mb="$4" borderWidth={1} borderColor="$error500"><Text bold color="$error600">Connection unavailable</Text><Text>{error}</Text><Text size="sm">Previously loaded values may be out of date.</Text></Panel> : null
const Loading = () => <HStack space="md" p="$8" alignItems="center"><Spinner /><Text>Reading the Pi…</Text></HStack>
const Reload = ({ onPress }) => <Button variant="outline" action="secondary" size="sm" onPress={onPress} accessibilityLabel="Refresh"><ButtonIcon as={RefreshCw} /><ButtonText>Refresh</ButtonText></Button>

export function ServicesView({ overview }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const list = overview.data?.services || []
  const groups = ['All', ...new Set(list.map(s => s.group))]
  const visible = list.filter(s => (group === 'All' || s.group === group) && (s.name + ' ' + s.notes).toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageTitle title="Services" description="The software installed on your Pi, with live process status."><Reload onPress={overview.refresh} /></PageTitle>
    <ErrorMessage error={overview.error} />
    <Input mb="$4" bg="$backgroundCardLight" sx={{ _dark: { bg: '$backgroundCardDark' } }}><InputField placeholder="Find a service…" accessibilityLabel="Find a service" aria-label="Find a service" value={query} onChangeText={setQuery} /></Input>
    <HStack flexWrap="wrap" gap="$2" mb="$5">{groups.map(g => <Button key={g} size="sm" variant={g === group ? 'solid' : 'outline'} action="secondary" onPress={() => setGroup(g)}><ButtonText>{g}</ButtonText></Button>)}</HStack>
    {overview.loading && !overview.data ? <Loading /> : <Panel>
      <ListHeader title={`${visible.length} ${visible.length === 1 ? 'service' : 'services'}`} description="Select an application for status, logs and setup details" />
      {visible.map(s => <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={'Open ' + s.name} onPress={() => navigate('/admin/services/' + s.id)}>
        <ListItem alignItems="flex-start" gap="$3"><VStack space="xs" flex={1}><Text bold>{s.name}</Text><Text size="sm" color="$muted500" dataSet={{ muted: true }}>{s.group}</Text>{needsSetup(s) ? <Text size="xs" color="$warning600">{s.readiness}</Text> : null}</VStack><Status good={serviceState(s) === 'Running'} bad={serviceState(s) === 'Failed'}>{serviceState(s)}</Status></ListItem>
      </Pressable>)}
      {!visible.length ? <Text p="$6">No services match this filter.</Text> : null}
    </Panel>}
  </>
}

export function Overview({ overview }) {
  const navigate = useNavigate()
  const d = overview.data
  const pending = d?.services.filter(needsSetup) || []
  return <>
    <PageTitle title="Your Pi, at a glance" description={d ? `Live connection to ${d.hostname} · Updated ${new Date(d.sampled_at * 1000).toLocaleTimeString()}` : 'Connecting to your home server'}><Reload onPress={overview.refresh} /></PageTitle>
    <ErrorMessage error={overview.error} />
    {!d ? (overview.error ? null : <Loading />) : <>
      <HStack flexWrap="wrap" gap="$4" mb="$5">
        <StatsWidget flex={1} minWidth={220} title="Managed services" text={`${d.services.filter(s => serviceState(s) === 'Running').length} running`} icon={Server} iconColor="$success600" textFooter={`${d.services.length} installed software groups`} />
        <StatsWidget flex={1} minWidth={220} title="Memory in use" text={formatBytes(d.memory_total - d.memory_available)} icon={MemoryStick} iconColor="$info500" textFooter={`${formatBytes(d.memory_total)} total`} />
        <StatsWidget flex={1} minWidth={220} title="System disk free" text={formatBytes(d.disk_free)} icon={HardDrive} iconColor="$violet500" textFooter="System volume, not NAS capacity" />
        <StatsWidget flex={1} minWidth={220} title="CPU temperature" text={d.temperature === null ? 'Unavailable' : `${d.temperature.toFixed(1)} °C`} icon={Cpu} iconColor="$warning500" textFooter={`${(d.uptime / 3600).toFixed(1)} hours uptime`} />
      </HStack>
      <HStack flexWrap="wrap" gap="$5" alignItems="flex-start">
        <Panel flex={2} minWidth={260}>
          <ListHeader title="Ready for the next step" description={`${pending.length} applications need setup or hardware`} />
          {pending.slice(0, 6).map(s => <Pressable key={s.id} onPress={() => navigate('/admin/services/' + s.id)}><ListItem><VStack flex={1} space="xs"><Text bold>{s.name}</Text><Text size="sm" color="$muted500" dataSet={{ muted: true }}>{s.readiness}</Text></VStack><Text color="$info600">View</Text></ListItem></Pressable>)}
          <Button m="$4" variant="outline" action="secondary" onPress={() => navigate('/admin/services')}><ButtonText>View all services</ButtonText></Button>
        </Panel>
        <VStack flex={1} minWidth={260} space="lg">
          <Panel p="$5"><Heading size="md" mb="$2">Your existing network stays in charge</Heading><Text>The Pi is connected to your switch and Wi-Fi access point. Router, DHCP and Wi-Fi policy controls are outside this dashboard.</Text></Panel>
          <Panel p="$5"><Heading size="md" mb="$2">Private access</Heading><Text mb="$4">Headscale connects your phones to the Pi. Normal internet traffic stays on each phone’s current connection.</Text><Button action="secondary" onPress={() => navigate('/admin/access')}><ButtonText>View connected devices</ButtonText></Button></Panel>
        </VStack>
      </HStack>
    </>}
  </>
}

export function ServiceDetail({ overview }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const s = overview.data?.services.find(x => x.id === id)
  const [logs, setLogs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setLogs(null); setMessage('') }, [id])
  if (!s) return overview.error ? <><ErrorMessage error={overview.error} /><Reload onPress={overview.refresh} /></> : overview.loading ? <Loading /> : <Text>Service not found.</Text>
  const getLogs = async () => {
    setBusy(true); setMessage('')
    try { setLogs((await request(`services/${id}/logs`)).text) }
    catch (e) { setMessage(e.message) }
    finally { setBusy(false) }
  }
  const action = async verb => {
    setBusy(true); setMessage('')
    try { await request(`services/${id}/${verb}`, {}); setMessage('Action completed. Refreshing service status…'); overview.refresh() }
    catch (e) { setMessage(e.message) }
    finally { setBusy(false) }
  }
  return <>
    <Button variant="link" alignSelf="flex-start" mb="$4" onPress={() => navigate('/admin/services')}><ButtonIcon as={ArrowLeft} /><ButtonText>Services</ButtonText></Button>
    <ErrorMessage error={overview.error} /><PageTitle title={s.name} description={s.group}><Status good={serviceState(s) === 'Running'} bad={serviceState(s) === 'Failed'}>{serviceState(s)}</Status></PageTitle>
    <Panel p="$5" mb="$5"><Heading size="md" mb="$3">Configuration and verification</Heading><Status>{s.readiness}</Status><Text mt="$4" lineHeight="$xl">{s.notes}</Text><Text mt="$3" size="xs" color="$muted500" dataSet={{ muted: true }}>Setup notes describe the recorded checks. Process status is refreshed live.</Text><Link href={s.source} isExternal mt="$4"><LinkText>Upstream documentation</LinkText></Link></Panel>
    <Panel p="$5" mb="$5"><Heading size="md" mb="$3">Service controls</Heading>
      {s.unit ? <><HStack flexWrap="wrap" gap="$3">{['start', 'stop', 'restart'].map(v => <Button key={v} action="secondary" variant="outline" isDisabled={busy || overview.data.read_only || s.protected} onPress={() => action(v)}><ButtonText>{v[0].toUpperCase() + v.slice(1)}</ButtonText></Button>)}</HStack><Text mt="$3" size="sm" color="$muted500" dataSet={{ muted: true }}>{s.protected ? 'Connectivity services are protected from changes here.' : overview.data.read_only ? 'Service changes are disabled.' : 'Actions apply to this application’s existing system service.'}</Text></> : <Text>This is an on-demand tool, or its service has not been configured yet.</Text>}
      {message ? <Text mt="$3" accessibilityRole="alert">{message}</Text> : null}
    </Panel>
    {s.unit ? <Panel><ListHeader title="Recent logs" description="Last 100 entries; credentials are redacted"><Button size="sm" action="secondary" variant="outline" isDisabled={busy} onPress={getLogs}><ButtonText>{busy ? 'Loading…' : 'Read logs'}</ButtonText></Button></ListHeader>{logs !== null ? <ScrollView maxHeight={480} horizontal><Text testID="pi-log-text" fontFamily="monospace" fontSize={12} p="$4">{logs || 'No log entries.'}</Text></ScrollView> : <Text p="$4" color="$muted500" dataSet={{ muted: true }}>Load the recent log entries for this service.</Text>}</Panel> : null}
  </>
}

export function AccessView() {
  const r = useResource('vpn', 20000)
  const [authId, setAuthId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const approve = async () => { setBusy(true); try { const d = await request('vpn/register', { auth_id: authId.trim() }); setMessage(`${d.name} approved`); setAuthId(''); r.refresh() } catch (e) { setMessage(e.message) } finally { setBusy(false) } }
  return <><PageTitle title="Private access" description="Your Headscale network and enrolled devices."><Reload onPress={r.refresh} /></PageTitle><ErrorMessage error={r.error} />
    <Panel p="$5" mb="$5"><Heading size="md">Connection address</Heading><Text mt="$2" selectable>{r.data?.server || 'https://matts.public.computer'}</Text><Text mt="$3" size="sm">Choose this alternate server in the Tailscale app. Keep Exit node set to None for access to home without routing ordinary internet traffic through the Pi.</Text></Panel>
    {!r.data ? (r.error ? null : <Loading />) : <Panel mb="$5"><ListHeader title="Devices" description={`${r.data.nodes.length} registered`} />{r.data.nodes.map(n => <ListItem key={n.id} alignItems="flex-start"><VStack space="xs" flex={1}><Text bold>{n.name}</Text><Text size="sm" selectable>{n.addresses.join(' · ')}</Text><Text size="xs" color="$muted500" dataSet={{ muted: true }}>{n.user}</Text></VStack><Status good={n.online}>{n.online ? 'Online' : 'Offline'}</Status></ListItem>)}</Panel>}
    <Panel p="$5"><Heading size="md" mb="$3">Add a phone</Heading><Text mb="$3">Enter the authentication ID shown after selecting the alternate server.</Text><Input><InputField accessibilityLabel="Phone authentication ID" aria-label="Phone authentication ID" placeholder="Authentication ID" value={authId} onChangeText={setAuthId} /></Input><Button alignSelf="flex-start" mt="$3" action="secondary" isDisabled={!authId.trim() || busy || r.data?.read_only !== false} onPress={approve}><ButtonText>Approve for owner</ButtonText></Button>{r.data?.read_only ? <Text size="sm" mt="$2" color="$muted500" dataSet={{ muted: true }}>Device approval is disabled in this dashboard.</Text> : null}{message ? <Text mt="$3">{message}</Text> : null}</Panel>
  </>
}

export function NetworkView({ overview }) {
  const d = overview.data
  return <><PageTitle title="Network" description="Live interfaces and routes on the Pi. Your switch and access point manage the LAN."><Reload onPress={overview.refresh} /></PageTitle><ErrorMessage error={overview.error} />{!d ? (overview.error ? null : <Loading />) : <><Panel mb="$5"><ListHeader title="Interfaces" />{d.interfaces.filter(i => i.ifname !== 'lo').map(i => <ListItem key={i.ifindex} alignItems="flex-start"><VStack flex={1} space="xs"><Text bold>{i.ifname}</Text><Text size="sm" selectable>{i.addr_info.filter(a => a.scope === 'global').map(a => `${a.local}/${a.prefixlen}`).join(' · ') || 'No global address'}</Text></VStack><Status good={i.operstate === 'UP'}>{i.operstate}</Status></ListItem>)}</Panel><Panel><ListHeader title="Default routes" />{d.routes.filter(r => r.dst === 'default').map((r,i) => <ListItem key={i}><Text selectable>{r.dev} → {r.gateway}</Text><Text size="sm">Metric {r.metric ?? 'default'}</Text></ListItem>)}</Panel></>}</>
}

export function TestsView() {
  const r = useResource('tests', 30000)
  return <><PageTitle title="Tests" description="Original SPR coverage, the Pi adaptation, and the latest recorded results."><Reload onPress={r.refresh} /></PageTitle><ErrorMessage error={r.error} />{!r.data ? (r.error ? null : <Loading />) : <><Panel p="$5" mb="$5"><Heading size="md">{r.data.state}</Heading><Text mt="$2">{r.data.summary || 'The test runner has not written a result yet.'}</Text>{r.data.recorded_at ? <Text size="xs" mt="$2" color="$muted500" dataSet={{ muted: true }}>Recorded {new Date(r.data.recorded_at).toLocaleString()}</Text> : null}</Panel>{(r.data.suites || []).map(s => <Panel key={s.name} p="$5" mb="$4"><HStack justifyContent="space-between" gap="$3"><Heading size="md" flex={1}>{s.name}</Heading><Status good={s.state === 'Passed'} bad={s.state === 'Failed'}>{s.state}</Status></HStack><Text mt="$3">{s.detail}</Text></Panel>)}</>}</>
}

export function SettingsView({ themeKey, onTheme }) {
  const r = useResource('provenance')
  return <><PageTitle title="Settings" description="Appearance and the scope of this Pi-specific port." />
    <Panel p="$5" mb="$5"><Heading size="md" mb="$3">SPR themes</Heading><HStack flexWrap="wrap" gap="$2">{themeList.map(t => <Button key={t.key} size="sm" variant={themeKey === t.key ? 'solid' : 'outline'} action="secondary" onPress={() => onTheme(t.key)}><ButtonText>{t.name}</ButtonText></Button>)}</HStack></Panel>
    <Panel p="$5"><Heading size="md" mb="$3">About this interface</Heading><Text>Adapted from the open-source SPR frontend. Navigation, themes, dashboard widgets and list components are retained from the original project.</Text><Text mt="$3">This interface reads the standalone services directly on the Pi when deployed, or through SSH in the laptop preview. It does not run SPR’s router runtime, install plugins, or change your access point.</Text><Text mt="$3">Wi-Fi simulation, per-device router policies and Docker lifecycle tests require the original router environment and are tracked separately.</Text>{r.data ? <Text mt="$4" size="xs" color="$muted500" dataSet={{ muted: true }} selectable>Upstream revision {r.data.commit}</Text> : null}<Link href="https://github.com/spr-networks/super" isExternal mt="$4"><LinkText>Original SPR project</LinkText></Link></Panel>
  </>
}

function Layout({ themeKey, onTheme, OverviewComponent = Overview, appearance, branding }) {
  const overview = useResource('overview', 20000)
  const location = useLocation()
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 800)
  const [open, setOpen] = useState(false)
  const [simple, setSimple] = useState(false)
  const active = location.pathname.split('/')[2] || 'home'
  const color = useColorMode()
  useEffect(() => { const resize = () => setMobile(window.innerWidth < 800); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [])
  const context = { activeSidebarItem: active, setActiveSidebarItem: () => {}, isSimpleMode: simple, isWifiDisabled: true, isPlusDisabled: true, isMeshNode: false }
  return <AppContext.Provider value={context}><VStack testID="pi-shell" dataSet={{ mode: color }} h="100vh" bg={color === 'dark' ? '$backgroundContentDark' : '$backgroundContentLight'}>
    <HStack testID="pi-header" h={72} flexShrink={0} px="$5" alignItems="center" gap="$3" borderBottomWidth={1} borderColor={color === 'dark' ? '$coolGray800' : '$coolGray200'} bg={color === 'dark' ? '$navbarBackgroundDark' : '$navbarBackgroundLight'}>
      {mobile ? <Button variant="outline" size="sm" action="secondary" accessibilityLabel="Toggle navigation" onPress={() => setOpen(v => !v)}><ButtonIcon as={Menu} /></Button> : null}
      {branding}<VStack flex={1}><Heading size="lg">Matt’s Pi</Heading><Text size="xs" color="$muted500" dataSet={{ muted: true }}>SPR interface · standalone services</Text></VStack>
      <Status alignSelf="center" good={!!overview.data && !overview.error}>{overview.error ? 'Disconnected' : overview.data ? 'Connected' : 'Connecting'}</Status>
      {!mobile ? <Status alignSelf="center">{overview.data?.deployed ? 'Private access' : 'Local preview'}</Status> : null}
    </HStack>
    <HStack flex={1} minHeight={0}>
      {(!mobile || open) ? <Box testID="pi-sidebar" w={mobile ? '100%' : 248} bg={color === 'dark' ? '$sidebarBackgroundDark' : '$sidebarBackgroundLight'}><Sidebar routes={piRoutes} isMobile={mobile} isMini={false} isOpenSidebar={open} setIsOpenSidebar={setOpen} isSimpleMode={simple} setIsSimpleMode={setSimple} /></Box> : null}
      {(!mobile || !open) ? <ScrollView flex={1}><VStack testID="pi-content" p={mobile ? '$4' : '$7'} w="$full" maxWidth={1500} alignSelf="center">
        {overview.data?.read_only ? <Text size="xs" mb="$5" color="$muted500" dataSet={{ muted: true }}>Live data · {overview.data?.deployed ? 'Running on your Pi · Service controls disabled' : 'Service changes disabled in this laptop preview'}</Text> : null}
        <StorageWarning overview={overview} />
        <Routes>
          <Route path="/admin/files" element={<FilesView overview={overview} />} />
          <Route path="/admin/home" element={<OverviewComponent overview={overview} />} />
          <Route path="/admin/services" element={<ServicesView overview={overview} />} />
          <Route path="/admin/services/:id" element={<ServiceDetail overview={overview} />} />
          <Route path="/admin/access" element={<AccessView />} />
          <Route path="/admin/network" element={<NetworkView overview={overview} />} />
          <Route path="/admin/tests" element={<TestsView />} />
          <Route path="/admin/settings" element={<>{appearance}<SettingsView themeKey={themeKey} onTheme={onTheme} /></>} />
          <Route path="*" element={<Navigate to="/admin/home" replace />} />
        </Routes>
      </VStack></ScrollView> : null}
    </HStack>
  </VStack></AppContext.Provider>
}

export default function PiApp({ OverviewComponent, appearance, branding }) {
  const [themeKey, setThemeKey] = useState(() => { try { return localStorage.getItem('pi-theme') || 'default:light' } catch { return 'default:light' } })
  const selected = themeList.find(t => t.key === themeKey) || themeList[0]
  const theme = themes[selected.id]
  const onTheme = key => { setThemeKey(key); try { localStorage.setItem('pi-theme', key) } catch {} }
  useEffect(() => {
    let element = document.getElementById('pi-theme-fonts')
    if (!element) { element = document.createElement('style'); element.id = 'pi-theme-fonts'; document.head.appendChild(element) }
    element.textContent = themeFontCss(theme?.font) || ''
  }, [theme])
  return <GluestackUIProvider config={config} colorMode={selected.colorMode || 'light'}><Theme name={selected.id} style={{ flex: 1 }}><BrowserRouter><Layout themeKey={themeKey} onTheme={onTheme} OverviewComponent={OverviewComponent} appearance={appearance} branding={branding} /></BrowserRouter></Theme></GluestackUIProvider>
}
