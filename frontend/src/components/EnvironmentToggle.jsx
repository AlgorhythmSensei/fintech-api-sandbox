import React from 'react'

export default function EnvironmentToggle({ environment, onChange }) {
  return (
    <div className="environment-control">
      <div className="environment-toggle" role="group" aria-label="API environment">
        <button className={environment.id === 'sandbox' ? 'selected sandbox' : ''} onClick={() => onChange('sandbox')}>Sandbox</button>
        <button className={environment.id === 'uat' ? 'selected uat' : ''} onClick={() => onChange('uat')}>Real UAT</button>
      </div>
      <span className={`environment-badge ${environment.id}`}>
        <span className="status-dot" />{environment.label} - {environment.host}
      </span>
    </div>
  )
}