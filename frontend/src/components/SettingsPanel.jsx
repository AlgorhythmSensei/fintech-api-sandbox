import React, { useEffect, useState } from 'react'
import ExportButton from './ExportButton'

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

export default function SettingsPanel({ settings, exportOptions, isExportingJUnit, onExportJUnit, onApply, onReset, onClose }) {
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
        <p className="eyebrow" id="settings-title">Configuration</p>
        <button className="icon-button settings-close" type="button" aria-label="Close connection settings" onClick={onClose}>x</button>
      </div>
      <div className="settings-content">
        {fields.map(({ key, label, hint }) => <label className="settings-field" htmlFor={key} key={key}>
          <span>{label}</span>
          <input id={key} type="url" aria-label={label} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
          <small>{hint}</small>
        </label>)}
        <section className="settings-export" aria-labelledby="postman-export-title">
          <div><h2 id="postman-export-title">Postman environment</h2><p>Download the active environment with the latest sandbox values.</p></div>
          <ExportButton {...exportOptions} />
        </section>
        <section className="settings-junit" aria-labelledby="junit-export-title">
          <div><h2 id="junit-export-title">JUnit XML report</h2><p>Run the isolated RPA suite and download a CI-compatible `results.xml` file.</p></div>
          <button className="secondary-button" type="button" onClick={onExportJUnit} disabled={isExportingJUnit}>{isExportingJUnit ? 'Creating XML...' : 'Export JUnit XML'}</button>
        </section>
        <section className="settings-documentation" aria-labelledby="documentation-title">
          <div><h2 id="documentation-title">API documentation</h2><p>Open the Sokin API reference in a new tab.</p></div>
          <a className="secondary-button" href="https://api-docs.sokin.com/" target="_blank" rel="noreferrer">Open documentation</a>
        </section>
        {error && <p className="settings-error" role="alert">{error}</p>}
      </div>
      <div className="settings-actions">
        <button className="secondary-button" type="button" onClick={onReset}>Reset defaults</button>
        <div><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="send-button" type="button" onClick={applySettings}>Apply settings</button></div>
      </div>
    </section>
  )
}
