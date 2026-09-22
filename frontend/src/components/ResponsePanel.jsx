import React from 'react'

export default function ResponsePanel({ response, error, isSending }) {
  const payload = response?.data
  const status = error ? 'Error' : response?.status
  const bodyText = error ? error : payload ? JSON.stringify(payload, null, 2) : 'Send a request to inspect the response.'

  return (
    <section className="response-panel">
      <div className="response-head">
        <div><p className="eyebrow">Response</p><h2>Server output</h2></div>
        {status && <span className={`response-status ${typeof status === 'number' && status < 300 ? 'success' : 'failure'}`}>{status}</span>}
      </div>
      <pre className="response-body">{isSending ? 'Waiting for UAT response...' : bodyText}</pre>
    </section>
  )
}