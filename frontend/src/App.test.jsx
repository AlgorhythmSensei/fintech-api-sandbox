import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const sandboxStateFixture = {
  accounts: [
    { reference: 'ACC-001', currency: 'AUD', balance: 125000, status: 'ACTIVE' },
    { reference: 'ACC-002', currency: 'USD', balance: 48200, status: 'ACTIVE' },
    { reference: 'ACC-003', currency: 'GBP', balance: 12500, status: 'ACTIVE' },
  ],
  beneficiaries: [{ id: 'BEN-001', name: 'Acme Corp' }],
  instructionRequests: [],
  fxRates: [],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it('resetSandbox clears spinner on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: async () => sandboxStateFixture }),
    )

    render(<App />)
    const button = screen.getByRole('button', { name: 'Reset Sandbox' })
    await userEvent.click(button)

    await waitFor(() => {
      expect(screen.queryByText('Refreshing sandbox state...')).not.toBeInTheDocument()
    })
  })

  it('resetSandbox clears spinner on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => {
        if (url.endsWith('/sandbox/reset')) return Promise.resolve({ ok: false })
        return Promise.resolve({ ok: true, json: async () => sandboxStateFixture })
      }),
    )

    render(<App />)
    const button = screen.getByRole('button', { name: 'Reset Sandbox' })
    await userEvent.click(button)

    await waitFor(() => {
      expect(screen.queryByText('Refreshing sandbox state...')).not.toBeInTheDocument()
      expect(screen.getByText('Unable to reset sandbox.')).toBeInTheDocument()
    })
  })

  it('sendRequest shows HTTP error text for non-JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => '<html>Bad Gateway</html>' }),
    )

    render(<App />)
    const sendButton = screen.getByRole('button', { name: 'Send request' })
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('Bad Gateway')).toBeInTheDocument()
    })
  })

  it('sendRequest extracts .detail from JSON error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ detail: 'Beneficiary not found.' }),
      }),
    )

    render(<App />)
    const sendButton = screen.getByRole('button', { name: 'Send request' })
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('Beneficiary not found.')).toBeInTheDocument()
    })
  })

  it('sendRequest joins array detail messages into a readable string', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ detail: [{ msg: 'field required' }, { msg: 'invalid value' }] }),
      }),
    )

    render(<App />)
    const sendButton = screen.getByRole('button', { name: 'Send request' })
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText(/field required/i)).toBeInTheDocument()
      expect(screen.getByText(/invalid value/i)).toBeInTheDocument()
    })
  })
})
