import React from 'react'

export default function SandboxDbPanel({ isOpen, state, isLoading, onToggle, onReset }) {
  return (
    <section className="sandbox-db-panel">
      <div className="sandbox-db-head">
        <div><p className="eyebrow">Sandbox data</p><h2>Sandbox DB</h2></div>
        <div className="sandbox-db-actions"><button className="secondary-button" onClick={onReset} disabled={isLoading}>Reset Sandbox</button><button className="collapse-button" onClick={onToggle}>{isOpen ? 'Hide' : 'Show'}</button></div>
      </div>
      {isOpen && <div className="sandbox-db-content">
        {isLoading ? <p className="db-empty">Refreshing sandbox state...</p> : <>
          <DbTable title="Accounts" rows={state?.accounts ?? []} columns={[['reference', 'Reference'], ['currency', 'Currency'], ['balance', 'Balance'], ['status', 'Status']]} />
          <DbTable title="Beneficiaries" rows={state?.beneficiaries ?? []} columns={[['id', 'ID'], ['name', 'Name'], ['currency', 'Currency'], ['status', 'Status']]} />
          <DbTable title="Instruction requests" rows={state?.instructionRequests ?? []} columns={[['instructionReference', 'Reference'], ['sellAmount', 'Sell amount'], ['status', 'Status']]} />
        </>}
      </div>}
    </section>
  )
}

function DbTable({ title, rows, columns }) {
  return <div className="db-section"><h3>{title}</h3>{rows.length === 0 ? <p className="db-empty">No records yet.</p> : <div className="table-wrap"><table><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? row.reference ?? index}>{columns.map(([key]) => <td key={key}>{typeof row[key] === 'number' ? row[key].toLocaleString() : row[key]}</td>)}</tr>)}</tbody></table></div>}</div>
}