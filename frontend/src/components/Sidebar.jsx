import React from 'react'

export default function Sidebar({ groups, selectedId, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="product-mark">
        <span className="mark-icon">S</span>
        <div>
          <strong>Sokin</strong>
          <span>Embedded API</span>
        </div>
      </div>
      <nav aria-label="API endpoints">
        {groups.map((group) => (
          <section className="endpoint-group" key={group.name}>
            <h2>{group.name}</h2>
            {group.endpoints.map((endpoint) => (
              <button
                className={`endpoint-link ${selectedId === endpoint.id ? 'selected' : ''}`}
                key={endpoint.id}
                onClick={() => onSelect(endpoint)}
              >
                <span className={`method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                <span>{endpoint.label}</span>
              </button>
            ))}
          </section>
        ))}
      </nav>
      <div className="sidebar-footer">UAT test console</div>
    </aside>
  )
}