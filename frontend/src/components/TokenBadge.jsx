import React from 'react'

export default function TokenBadge({ token, expiresAt, onClear }) {
  const isActive = Boolean(token)
  const status = isActive ? 'Active token' : token ? 'Expired token' : 'No token'

  return (
    <div className={`token-badge ${isActive ? 'active' : ''}`}>
      <span className="status-dot" />
      <div>
        <strong>{status}</strong>
        <span>{isActive && expiresAt ? `Expires ${new Date(expiresAt).toLocaleTimeString()}` : 'Authenticate to start testing'}</span>
      </div>
      {token && <button className="icon-button" onClick={onClear} title="Clear stored token" aria-label="Clear stored token">x</button>}
    </div>
  )
}