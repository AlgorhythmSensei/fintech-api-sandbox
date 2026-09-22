import React, { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import './App.css'
import Sidebar from './components/Sidebar'
import RequestPanel from './components/RequestPanel'
import ResponsePanel from './components/ResponsePanel'
import TokenBadge from './components/TokenBadge'
import EnvironmentToggle from './components/EnvironmentToggle'
import SandboxDbPanel from './components/SandboxDbPanel'
import SettingsPanel from './components/SettingsPanel'
import ExportButton from './components/ExportButton'
import { generateSample } from './sampleData'

const defaultSettings = {
  sandboxBaseUrl: 'http://127.0.0.1:8001',
  uatProxyUrl: 'http://127.0.0.1:8002',
  uatApiUrl: 'https://api-uat.sokin.com',
}

const groups = [
  { name: 'Auth', endpoints: [{ id: 'auth-token', label: 'Get access token', title: 'OAuth access token', method: 'POST', path: '/oauth/token', description: 'Uses the UAT client credentials configured on the FastAPI server.', sample: { grant_type: 'client_credentials' } }] },
  { name: 'Foreign Exchange', endpoints: [{ id: 'fx-rate', label: 'Get FX rate', title: 'Foreign exchange rate', method: 'POST', path: '/fx/rate', description: 'Price a conversion before creating an instruction.', sample: { sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 10000.0, fixedSide: 'sell', paymentDate: '2026-09-23', paymentType: 'REGULAR' } }] },
  { name: 'Instruction Requests', endpoints: [{ id: 'instruction-create', label: 'Create instruction', title: 'Create instruction request', method: 'POST', path: '/instruction-requests', description: 'Create a UAT payment instruction request.', sample: { instructionType: 'PAYMENT', sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 10000.0, fixedSide: 'sell', paymentDate: '2026-09-23', paymentType: 'REGULAR', beneficiaryId: 'BEN-001', reference: 'INV-001' } }, { id: 'instruction-get', label: 'Get instruction', title: 'Get instruction request', method: 'GET', path: '/instruction-requests/INV-001', description: 'Retrieve an instruction by its reference.', sample: null }] },
  { name: 'Corporate Currency Accounts', endpoints: [{ id: 'accounts-list', label: 'List accounts', title: 'Corporate currency accounts', method: 'GET', path: '/corporate-currency-accounts', description: 'List corporate currency accounts.', sample: null }, { id: 'account-get', label: 'Get account', title: 'Get corporate currency account', method: 'GET', path: '/corporate-currency-accounts/ACC-001', description: 'Retrieve an account by reference.', sample: null }] },
  { name: 'Beneficiaries', endpoints: [{ id: 'beneficiaries-list', label: 'List beneficiaries', title: 'Beneficiaries', method: 'GET', path: '/beneficiaries', description: 'List registered beneficiaries.', sample: null }, { id: 'beneficiary-create', label: 'Create beneficiary', title: 'Create beneficiary', method: 'POST', path: '/beneficiaries', description: 'Create a beneficiary for UAT testing.', sample: { name: 'Acme Corp', currency: 'USD', accountNumber: '123456789', routingNumber: '021000021', bankCountry: 'US', paymentType: 'REGULAR' } }] },
]

const firstEndpoint = groups[0].endpoints[0]
const asJson = (value) => (value ? JSON.stringify(value, null, 2) : '')

function App() {
  const [endpoint, setEndpoint] = useState(firstEndpoint)
  const [body, setBody] = useState(asJson(firstEndpoint.sample))
  const [environmentId, setEnvironmentId] = useState('sandbox')
  const [token, setToken] = useState('')
  const [expiresAt, setExpiresAt] = useState(null)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sandboxState, setSandboxState] = useState(null)
  const [isSandboxDbOpen, setIsSandboxDbOpen] = useState(true)
  const [isSandboxStateLoading, setIsSandboxStateLoading] = useState(false)
  const [isUatEndpointTestLoading, setIsUatEndpointTestLoading] = useState(false)
  const [lastRateId, setLastRateId] = useState('')
  const [lastInstructionRef, setLastInstructionRef] = useState('')
  const [lastAccountRef, setLastAccountRef] = useState('')
  const [lastBeneficiaryId, setLastBeneficiaryId] = useState('')
  const [settings, setSettings] = useState(defaultSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const environments = {
    sandbox: { id: 'sandbox', label: 'SANDBOX', host: new URL(settings.sandboxBaseUrl).host, baseUrl: settings.sandboxBaseUrl },
    uat: { id: 'uat', label: 'REAL UAT', host: new URL(settings.uatApiUrl).host, baseUrl: settings.uatProxyUrl, apiUrl: settings.uatApiUrl },
  }
  const environment = environments[environmentId]

  useEffect(() => {
    if (!token || !expiresAt) return undefined
    const timeout = window.setTimeout(() => {
      setToken('')
      setExpiresAt(null)
    }, Math.max(0, expiresAt - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [token, expiresAt])

  useEffect(() => {
    if (environmentId === 'sandbox') refreshSandboxState()
  }, [environmentId])

  async function refreshSandboxState() {
    setIsSandboxStateLoading(true)
    try {
      const result = await fetch(`${settings.sandboxBaseUrl}/sandbox/state`)
      if (!result.ok) throw new Error('Unable to load sandbox state.')
      setSandboxState(await result.json())
    } catch (stateError) {
      setError(stateError.message)
    } finally { setIsSandboxStateLoading(false) }
  }

  async function resetSandbox() {
    setIsSandboxStateLoading(true)
    try {
      const result = await fetch(`${settings.sandboxBaseUrl}/sandbox/reset`, { method: 'POST' })
      if (!result.ok) throw new Error('Unable to reset sandbox.')
      await refreshSandboxState()
    } catch (stateError) {
      setError(stateError.message)
    } finally {
      setIsSandboxStateLoading(false)
    }
  }

  function selectEndpoint(nextEndpoint) {
    setEndpoint(nextEndpoint)
    setBody(asJson(nextEndpoint.sample))
    setResponse(null)
    setError('')
  }

  function selectEnvironment(nextEnvironmentId) {
    setEnvironmentId(nextEnvironmentId)
    setToken('')
    setExpiresAt(null)
    setResponse(null)
    setError('')
  }

  async function testUatEndpoints() {
    setIsUatEndpointTestLoading(true)
    setError('')
    setResponse(null)
    try {
      const result = await fetch(`${settings.uatProxyUrl}/api/v1/test-uat-endpoints`, { method: 'POST' })
      if (!result.ok) {
        const text = await result.text()
        let detail
        try { detail = JSON.parse(text).detail } catch { detail = text.replace(/<[^>]*>/g, '').trim() || 'The request failed.' }
        throw new Error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail)
      }
      setResponse({ status: result.status, data: await result.json() })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsUatEndpointTestLoading(false)
    }
  }

  async function sendRequest() {
    let parsedBody = null
    if (endpoint.method === 'POST') {
      try { parsedBody = JSON.parse(body) } catch { setError('The request body must be valid JSON.'); return }
    }
    setIsSending(true)
    setError('')
    setResponse(null)
    try {
      const requestUrl = environment.id === 'sandbox'
        ? `${environment.baseUrl}${endpoint.path}`
        : `${environment.baseUrl}/proxy`
      const requestOptions = environment.id === 'sandbox'
        ? { method: endpoint.method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: endpoint.method === 'POST' ? JSON.stringify(parsedBody) : undefined }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: endpoint.method, path: endpoint.path, body: parsedBody, token }) }
      const result = await fetch(requestUrl, requestOptions)
      let data
      if (!result.ok) {
        const text = await result.text()
        let detail
        try { detail = JSON.parse(text).detail } catch { detail = text.replace(/<[^>]*>/g, '').trim() || 'The request failed.' }
        throw new Error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail)
      }
      data = await result.json()
      const normalizedResponse = environment.id === 'sandbox' ? { status: result.status, data } : data
      setResponse(normalizedResponse)
      const payload = normalizedResponse.data
      if (endpoint.id === 'fx-rate') setLastRateId(payload?.rateId ?? '')
      if (endpoint.id === 'instruction-create') setLastInstructionRef(payload?.instructionReference ?? '')
      if (endpoint.id === 'account-get') setLastAccountRef(payload?.reference ?? '')
      if (endpoint.id === 'accounts-list') setLastAccountRef(payload?.accounts?.at(-1)?.reference ?? '')
      if (endpoint.id === 'beneficiary-create') setLastBeneficiaryId(payload?.id ?? '')
      if (environment.id === 'sandbox' && endpoint.id === 'instruction-create') await refreshSandboxState()
      if (endpoint.id === 'auth-token' && normalizedResponse.status < 300 && normalizedResponse.data?.access_token) {
        setToken(normalizedResponse.data.access_token)
        setExpiresAt(Date.now() + (normalizedResponse.data.expires_in || 3600) * 1000)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally { setIsSending(false) }
  }

  return (
    <div className="app-shell">
      <Sidebar groups={groups} selectedId={endpoint.id} onSelect={selectEndpoint} />
      <main className="workspace">
        <header className="topbar"><EnvironmentToggle environment={environment} onChange={selectEnvironment} /><div className="header-actions">{environment.id === 'uat' && <button className="secondary-button" type="button" onClick={testUatEndpoints} disabled={isUatEndpointTestLoading}>{isUatEndpointTestLoading ? 'Testing UAT endpoints...' : 'Test UAT endpoints'}</button>}<ExportButton environment={environment.id} token={token} lastRateId={lastRateId} lastInstructionRef={lastInstructionRef} lastAccountRef={lastAccountRef} lastBeneficiaryId={lastBeneficiaryId} /><a className="docs-link" href="https://api-docs.sokin.com/" target="_blank" rel="noreferrer">API documentation</a><button className="header-icon-button" type="button" aria-label="Open connection settings" title="Connection settings" onClick={() => setIsSettingsOpen(true)}><Settings size={17} strokeWidth={2} /></button><TokenBadge token={token} expiresAt={expiresAt} onClear={() => { setToken(''); setExpiresAt(null) }} /></div></header>
        {isSettingsOpen ? <SettingsPanel settings={settings} onApply={(nextSettings) => { setSettings(nextSettings); setIsSettingsOpen(false) }} onReset={() => setSettings(defaultSettings)} onClose={() => setIsSettingsOpen(false)} /> : <><div className="content-grid">
          <RequestPanel endpoint={endpoint} baseUrl={environment.id === 'sandbox' ? environment.baseUrl : environment.apiUrl} body={body} onBodyChange={setBody} onLoadSample={() => setBody(asJson(generateSample(endpoint)))} onSend={sendRequest} isSending={isSending} tokenStatus={Boolean(token)} />
          <ResponsePanel response={response} error={error} isSending={isSending} />
        </div>
        {environment.id === 'sandbox' && <SandboxDbPanel isOpen={isSandboxDbOpen} state={sandboxState} isLoading={isSandboxStateLoading} onToggle={() => setIsSandboxDbOpen(!isSandboxDbOpen)} onReset={resetSandbox} />}</>}
      </main>
    </div>
  )
}

export default App
