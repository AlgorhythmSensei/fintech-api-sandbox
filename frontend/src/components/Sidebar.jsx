import React, { useRef, useState } from 'react'

export default function Sidebar({ groups, selectedId, onSelect }) {
  const [hoveredEndpointId, setHoveredEndpointId] = useState('')
  const hoverTimer = useRef(null)

  function showEndpointPreview(endpointId) {
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHoveredEndpointId(endpointId), 1000)
  }

  function hideEndpointPreview() {
    window.clearTimeout(hoverTimer.current)
    setHoveredEndpointId('')
  }

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
                onMouseEnter={() => showEndpointPreview(endpoint.id)}
                onMouseLeave={hideEndpointPreview}
                onFocus={() => showEndpointPreview(endpoint.id)}
                onBlur={hideEndpointPreview}
              >
                <span className={`method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                <span>{endpoint.label}</span>
                {hoveredEndpointId === endpoint.id && <span className="endpoint-tooltip" role="tooltip"><strong>{endpoint.title}</strong><span className="endpoint-tooltip-path">{endpoint.method} {endpoint.path}</span><span>{endpoint.method === 'GET' ? 'Retrieves existing data without changing sandbox state.' : 'Submits data and may create or update sandbox state.'}</span><span>{endpoint.description}</span></span>}
              </button>
            ))}
          </section>
        ))}
      </nav>
      <div className="sidebar-footer">UAT test console</div>
    </aside>
  )
}