import React, { useEffect, useRef, useState } from 'react'

const scenarios = [
  'Reset sandbox', 'Get auth token', 'Get AUD/USD FX rate', 'List accounts', 'List beneficiaries',
  'Get account', 'Create beneficiary', 'Create instruction', 'Get instruction', 'Check insufficient balance',
]

function buildPreviewUrl() {
  const url = new URL(window.location.href)
  url.search = 'rpa-preview=1'
  return url.toString()
}

export default function RpaMonitor({ autoRun, proxyUrl, sandboxUrl }) {
  const hasAutoRun = useRef(false)
  const previewRef = useRef(null)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState(null)

  function frameDocument() {
    return previewRef.current?.contentDocument
  }

  function pause(milliseconds = 450) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
  }

  function clickPreviewButton(label) {
    const button = [...frameDocument().querySelectorAll('button')].find((item) => item.textContent.includes(label) || item.getAttribute('aria-label') === label)
    if (!button) throw new Error(`Could not find ${label} in the sandbox preview.`)
    button.click()
  }

  function fillPreviewJson(value) {
    const textarea = frameDocument().querySelector('textarea')
    if (!textarea) throw new Error('Could not find the JSON request editor.')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(textarea, JSON.stringify(value, null, 2))
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }

  async function selectPreviewEndpoint(label) {
    clickPreviewButton(label)
    await pause(250)
  }

  async function replayPreview() {
    const suffix = String(Date.now()).slice(-6)
    const actions = [
      async () => { clickPreviewButton('Reset Sandbox'); await pause() },
      async () => { await selectPreviewEndpoint('Get access token'); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('Get FX rate'); fillPreviewJson({ sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 10000, paymentDate: '2026-10-15' }); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('List accounts'); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('Get account'); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('List beneficiaries'); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('Create beneficiary'); fillPreviewJson({ name: `RPA Demo ${suffix}`, currency: 'USD', accountNumber: '123456789', routingNumber: '021000021', bankCountry: 'US', paymentType: 'REGULAR' }); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('Create instruction'); fillPreviewJson({ instructionType: 'PAYMENT', sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 10000, paymentDate: '2026-10-15', beneficiaryId: 'BEN-001', reference: 'INV-001' }); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('Get instruction'); clickPreviewButton('Send request'); await pause() },
      async () => { await selectPreviewEndpoint('Create instruction'); fillPreviewJson({ instructionType: 'PAYMENT', sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 200000, paymentDate: '2026-10-15', beneficiaryId: 'BEN-001', reference: `FAIL-${suffix}` }); clickPreviewButton('Send request'); await pause() },
    ]
    for (let index = 0; index < actions.length; index += 1) {
      await actions[index]()
      setCompletedSteps(index + 1)
    }
  }

  async function runWalkthrough() {
    setIsRunning(true)
    setResult(null)
    setCompletedSteps(0)
    try {
      const [response] = await Promise.all([
        fetch(`${proxyUrl}/api/v1/run-rpa`, { method: 'POST' }),
        replayPreview(),
      ])
      const data = await response.json()
      setResult(response.ok ? data : { passed: false, output: data.detail || 'The RPA walkthrough failed.' })
    } catch (error) {
      setResult({ passed: false, output: error.message })
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    if (autoRun && !hasAutoRun.current) {
      hasAutoRun.current = true
      runWalkthrough()
    }
  }, [autoRun])

  const completed = completedSteps || (result?.output?.match(/^PASS /gm)?.length ?? 0)
  const sandboxHost = new URL(sandboxUrl).host

  const serverOutput = result?.output ?? ''

  return <main className="rpa-monitor">
    <header className="rpa-monitor-head"><div><p className="eyebrow">Live browser monitor</p><h1>Sandbox RPA walkthrough</h1></div><div className="rpa-monitor-actions"><span className="rpa-monitor-environment">SANDBOX · {sandboxHost}</span><button className="rpa-launch-button" type="button" onClick={runWalkthrough} disabled={isRunning}>{isRunning ? 'Running RPA demo...' : 'Run RPA demo'}</button></div></header>
    <div className="rpa-monitor-grid">
      <section className="rpa-preview"><div className="rpa-preview-head"><strong>Sandbox UI preview</strong><span>{isRunning ? 'RPA running' : result ? `${completed}/10 complete` : 'Waiting for launch'}</span></div><iframe ref={previewRef} title="Sandbox UI preview" src={buildPreviewUrl()} /></section>
      <section className="rpa-monitor-status">
        <h2>Scenario progress</h2>
        <p className="rpa-monitor-note">Runs Playwright in an isolated browser under the bonnet and replays each visible UI action here.</p>
        <ol>{scenarios.map((scenario, index) => <li className={index < completed ? 'complete' : isRunning && index === completed ? 'running' : ''} key={scenario}>{scenario}</li>)}</ol>
        <p className="rpa-monitor-note rpa-monitor-status-line">{isRunning ? 'Playwright is running — server output will appear below when complete.' : result ? (result.passed ? `Passed ${completed}/10 scenarios.` : 'Run failed — see server output below.') : 'Press Run RPA demo to start.'}</p>
        <h2 className="rpa-server-output-label">Server output</h2>
        <pre className={`rpa-monitor-log ${result ? (result.passed ? 'success' : 'failure') : ''}`}>{isRunning ? 'Waiting for Playwright to finish...' : serverOutput || 'No output yet.'}</pre>
      </section>
    </div>
  </main>
}
