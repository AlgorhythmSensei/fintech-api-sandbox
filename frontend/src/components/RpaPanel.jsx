import React from 'react'

export default function RpaPanel({ isApplyingDemo, isRunning, result, trace, onApplyDemo, onOpenMonitor, onReset, onRun }) {
  return (
    <section className="rpa-panel" aria-labelledby="rpa-title">
      <div className="rpa-head">
        <div><p className="eyebrow">Automation</p><h2 id="rpa-title">RPA walkthrough</h2><p>Runs all 11 sandbox scenarios: reset, token, FX rate, list/get accounts, beneficiaries, payment, retrieval, insufficient balance, and Postman export.</p></div>
        <div className="rpa-actions"><button className="secondary-button" type="button" onClick={onOpenMonitor}>Open RPA monitor</button><button className="secondary-button" type="button" onClick={onReset} disabled={isApplyingDemo || isRunning}>Reset sandbox defaults</button><button className="secondary-button" type="button" onClick={onApplyDemo} disabled={isApplyingDemo || isRunning}>{isApplyingDemo ? 'Applying demo data...' : 'Apply demo data'}</button><button className="send-button" type="button" onClick={onRun} disabled={isRunning || isApplyingDemo}>{isRunning ? 'Running RPA...' : 'Run RPA walkthrough'}</button></div>
      </div>
      <pre className={`rpa-result ${result ? (result.passed ? 'success' : 'failure') : ''}`}>{isApplyingDemo ? 'Writing demo beneficiary, FX rate, and payment instruction to the live sandbox database.' : isRunning ? 'Running sandbox scenarios. Results will appear here when the walkthrough completes.' : result?.output ?? 'No walkthrough has run in this browser session.'}</pre>
      {trace && <><p className="rpa-trace-label">JSON messages written to the sandbox</p><pre className="rpa-trace">{JSON.stringify(trace, null, 2)}</pre></>}
    </section>
  )
}
