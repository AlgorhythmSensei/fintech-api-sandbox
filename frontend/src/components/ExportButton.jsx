import React from 'react'

function buildPostmanEnv({
  environment,
  token,
  lastRateId,
  lastInstructionRef,
  lastAccountRef,
  lastBeneficiaryId,
}) {
  const isSandbox = environment === 'sandbox'
  const baseUrl = isSandbox ? 'http://localhost:8001' : 'https://api-uat.sokin.com'
  const fallbackToken = isSandbox && !token ? 'mock-token-abc123' : token || ''

  const env = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `postman-env-${Date.now()}`,
    name: isSandbox ? 'Sokin SANDBOX' : 'Sokin REAL UAT',
    values: [
      { key: 'auth_base_url', value: baseUrl, enabled: true },
      { key: 'api_base_url', value: baseUrl, enabled: true },
      { key: 'token', value: fallbackToken, enabled: true },
      { key: 'account_ref', value: isSandbox ? 'ACC-001' : (lastAccountRef || ''), enabled: true },
      { key: 'beneficiary_id', value: isSandbox ? 'BEN-001' : (lastBeneficiaryId || ''), enabled: true },
      { key: 'rate_id', value: lastRateId || '', enabled: true },
      { key: 'instruction_ref', value: lastInstructionRef || '', enabled: true },
    ],
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'Sokin Tester UI',
  }

  return env
}

function downloadJson(json, filename) {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function ExportButton({
  environment,
  token,
  lastRateId,
  lastInstructionRef,
  lastAccountRef,
  lastBeneficiaryId,
  onExport,
}) {
  const fileName = environment === 'sandbox'
    ? 'sokin-sandbox.postman_environment.json'
    : 'sokin-uat.postman_environment.json'

  const handleClick = () => {
    const json = buildPostmanEnv({
      environment,
      token,
      lastRateId,
      lastInstructionRef,
      lastAccountRef,
      lastBeneficiaryId,
    })
    downloadJson(json, fileName)
    if (onExport) onExport()
  }

  return (
    <button
      className="export-button"
      onClick={handleClick}
      type="button"
      title="To import: open Postman → File → Import → select the downloaded file → switch to the new environment in the top-right dropdown"
    >
      ⬇ Export to Postman
    </button>
  )
}

export { buildPostmanEnv, downloadJson }
