import React, { useEffect, useState } from 'react'

const fields = [
  { key: 'sandboxBaseUrl', label: 'Sandbox API URL', hint: 'Used for all local sandbox requests and state refreshes.' },
  { key: 'uatProxyUrl', label: 'UAT proxy URL', hint: 'Local FastAPI proxy that keeps UAT credentials server-side.' },
  { key: 'uatApiUrl', label: 'UAT API URL', hint: 'Displayed as the target API in the request editor.' },
]

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (e) {
    return false
  }
}

export default function SettingsPanel({ settings, onApply, onReset, onClose }) {
  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  function applySettings() {
    if (fields.some(({ key }) => !isHttpUrl(draft[key]))) {
      setError('Enter a complete HTTP or HTTPS URL for every connection.')
      return
    }
    onApply(draft)
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-head">
        <div><p className="eyebrow">Configuration</p><h1 id="settings-title">Connection settings</h1></div>
        <button className="icon-button settings-close" type="button" aria-label="Close connection settings" onClick={onClose}>x</button>
      </div>
      <div className="settings-content">
        {fields.map(({ key, label, hint }) => <label className="settings-field" htmlFor={key} key={key}>
          <span>{label}</span>
          <input id={key} type="url" aria-label={label} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
          <small>{hint}</small>
        </label>)}
        {error && <p className="settings-error" role="alert">{error}</p>}
      </div>
      <div className="settings-actions">
        <button className="secondary-button" type="button" onClick={onReset}>Reset defaults</button>
        <div><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="send-button" type="button" onClick={applySettings}>Apply settings</button></div>
      </div>
    </section>
  )
}
