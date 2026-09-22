import React from 'react'

export default function RequestPanel({ endpoint, baseUrl, body, onBodyChange, onLoadSample, onSend, isSending, tokenStatus }) {
  const requiresToken = endpoint.id !== 'auth-token'

  return (
    <section className="request-panel">
      <div className="request-head">
        <div>
          <p className="eyebrow">Request</p>
          <h1>{endpoint.title}</h1>
          <p className="endpoint-description">{endpoint.description}</p>
        </div>
        <span className={`method method-${endpoint.method.toLowerCase()} large`}>{endpoint.method}</span>
      </div>

      <div className="url-bar">
        <span>{baseUrl}</span><strong>{endpoint.path}</strong>
      </div>

      {requiresToken && !tokenStatus && <div className="notice">Authenticate with the OAuth endpoint before sending this request.</div>}

      {endpoint.method === 'POST' ? (
        <label className="editor-label">
          <span>JSON body</span>
          <textarea value={body} spellCheck="false" onChange={(event) => onBodyChange(event.target.value)} />
        </label>
      ) : (
        <div className="get-body">This GET request has no JSON body. Update the reference in the URL if needed.</div>
      )}

      <div className="request-actions">
        <button className="secondary-button load-sample-button" onClick={onLoadSample}>Load sample values</button>
        <button className="send-button" onClick={onSend} disabled={isSending}>
          {isSending ? 'Sending...' : 'Send request'}
        </button>
      </div>
    </section>
  )
}