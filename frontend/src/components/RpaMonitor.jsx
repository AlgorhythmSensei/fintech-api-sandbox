import React, { useRef, useState } from 'react'

const scenarios = [
  'Reset sandbox', 'Get auth token', 'Get AUD/USD FX rate', 'List accounts', 'List beneficiaries',
  'Get account', 'Create beneficiary', 'Create instruction', 'Get instruction', 'Check insufficient balance', 'Export Postman environment',
]

function buildPreviewUrl() {
  const url = new URL(window.location.href)
  url.search = ''
  return url.toString()
}

export default function RpaMonitor({ proxyUrl }) {
  const previewRef = useRef(null)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [isVisualDemoRunning, setIsVisualDemoRunning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState(null)

  function frameDocument() {
    return previewRef.current?.contentDocument
  }

  function pause(milliseconds = 500) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
  }

  function clickButton(label) {
    const button = [...frameDocument().querySelectorAll('button')].find((item) => item.textContent.includes(label) || item.getAttribute('aria-label') === label)
    if (!button) throw new Error(`Could not find ${label} in the sandbox preview.`)
    button.click()
  }

  function fillJson(value) {
    const textarea = frameDocument().querySelector('textarea')
    if (!textarea) throw new Error('Could not find the JSON request editor.')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(textarea, JSON.stringify(value, null, 2))
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }

  async function selectEndpoint(label) {
    clickButton(label)
    await pause(250)
  }

  async function resetPreviewSandbox() {
    clickButton('Reset Sandbox')
    setCompletedSteps(0)
    setResult({ passed: true, output: 'Sandbox reset to defaults. The preview is ready for another visual walkthrough.' })
    await pause()
  }

  async function runVisualDemo() {
    setIsVisualDemoRunning(true)
    setCompletedSteps(0)
    setResult(null)
    const suffix = String(Date.now()).slice(-6)
    const instructionReference = 'INV-001'
    try {
      const steps = [
        async () => { clickButton('Reset Sandbox'); await pause() },
        async () => { await selectEndpoint('Get access token'); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('Get FX rate'); fillJson({ sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 10000, paymentDate: '2026-10-15' }); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('List accounts'); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('Get account'); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('List beneficiaries'); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('Create beneficiary'); fillJson({ name: `RPA Demo ${suffix}`, currency: 'USD', accountNumber: '123456789', routingNumber: '021000021', bankCountry: 'US', paymentType: 'REGULAR' }); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('Create instruction'); fillJson({ instructionType: 'PAYMENT', sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 10000, paymentDate: '2026-10-15', beneficiaryId: 'BEN-001', reference: instructionReference }); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('Get instruction'); clickButton('Send request'); await pause() },
        async () => { await selectEndpoint('Create instruction'); fillJson({ instructionType: 'PAYMENT', sellCurrency: 'AUD', buyCurrency: 'USD', sellAmount: 200000, paymentDate: '2026-10-15', beneficiaryId: 'BEN-001', reference: `FAIL-${suffix}` }); clickButton('Send request'); await pause() },
        async () => { clickButton('Open connection settings'); await pause(); clickButton('Export to Postman'); await pause() },
      ]
      for (let index = 0; index < steps.length; index += 1) {
        await steps[index]()
        setCompletedSteps(index + 1)
      }
      setResult({ passed: true, output: `Visual demo completed. ${instructionReference} was written through the displayed sandbox UI.` })
    } catch (error) {
      setResult({ passed: false, output: error.message })
    } finally {
      setIsVisualDemoRunning(false)
    }
  }

  async function runWalkthrough() {
    setIsRunning(true)
    setResult(null)
    try {
      const response = await fetch(`${proxyUrl}/api/v1/run-rpa`, { method: 'POST' })
      const data = await response.json()
      setResult(response.ok ? data : { passed: false, output: data.detail || 'The RPA walkthrough failed.' })
    } catch (error) {
      setResult({ passed: false, output: error.message })
    } finally {
      setIsRunning(false)
    }
  }

  const completed = isVisualDemoRunning || completedSteps ? completedSteps : result?.output?.match(/^PASS /gm)?.length ?? 0

  return <main className="rpa-monitor">
    <header className="rpa-monitor-head"><div><p className="eyebrow">Live browser monitor</p><h1>Sandbox RPA walkthrough</h1></div><div className="rpa-monitor-actions"><button className="secondary-button" type="button" onClick={resetPreviewSandbox} disabled={isRunning || isVisualDemoRunning}>Reset sandbox defaults</button><button className="secondary-button" type="button" onClick={runWalkthrough} disabled={isRunning || isVisualDemoRunning}>{isRunning ? 'Running isolated RPA...' : 'Run isolated RPA'}</button><button className="send-button" type="button" onClick={runVisualDemo} disabled={isRunning || isVisualDemoRunning}>{isVisualDemoRunning ? 'Playing visual demo...' : 'Play visual demo'}</button></div></header>
    <div className="rpa-monitor-grid">
      <section className="rpa-preview"><div className="rpa-preview-head"><strong>Sandbox UI preview</strong><span>{isVisualDemoRunning ? 'Visible demo running' : isRunning ? 'Isolated RPA running' : result ? `${completed}/11 complete` : 'Ready'}</span></div><iframe ref={previewRef} title="Sandbox UI preview" src={buildPreviewUrl()} /></section>
      <section className="rpa-monitor-status"><h2>Scenario progress</h2><ol>{scenarios.map((scenario, index) => <li className={index < completed ? 'complete' : (isRunning || isVisualDemoRunning) && index === completed ? 'running' : ''} key={scenario}>{scenario}</li>)}</ol><pre className={`rpa-monitor-log ${result ? (result.passed ? 'success' : 'failure') : ''}`}>{isVisualDemoRunning ? 'The preview is visibly clicking buttons and writing JSON into its request editor.' : isRunning ? 'The isolated Playwright browser is executing the sandbox workflow. Completed steps will be listed when it finishes.' : result?.output ?? 'Choose Play visual demo to watch the UI actions, or Run isolated RPA for the recorded regression suite.'}</pre></section>
    </div>
  </main>
}
