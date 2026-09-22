const currencyPairs = [
  { sellCurrency: 'AUD', buyCurrency: 'USD' },
  { sellCurrency: 'AUD', buyCurrency: 'GBP' },
  { sellCurrency: 'USD', buyCurrency: 'GBP' },
  { sellCurrency: 'EUR', buyCurrency: 'USD' },
  { sellCurrency: 'AUD', buyCurrency: 'AED' },
  { sellCurrency: 'AUD', buyCurrency: 'SGD' },
]

const beneficiaryProfiles = [
  { name: 'Northstar Trading Pty Ltd', currency: 'USD', bankCountry: 'US', routingNumber: '021000021' },
  { name: 'Harbor Supply Company', currency: 'GBP', bankCountry: 'GB', routingNumber: '404004' },
  { name: 'Summit Works Limited', currency: 'USD', bankCountry: 'US', routingNumber: '026009593' },
]

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function randomAmount() {
  return Number((2500 + Math.random() * 22500).toFixed(2))
}

function futurePaymentDate() {
  const paymentDate = new Date()
  paymentDate.setDate(paymentDate.getDate() + 7 + Math.floor(Math.random() * 21))
  return paymentDate.toISOString().slice(0, 10)
}

function uniqueReference(prefix) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const suffix = Math.floor(100000 + Math.random() * 900000)
  return `${prefix}-${date}-${suffix}`
}

function accountNumber() {
  return String(Math.floor(100000000 + Math.random() * 900000000))
}

export function generateSample(endpoint) {
  if (endpoint.id === 'fx-rate') {
    return { ...randomItem(currencyPairs), sellAmount: randomAmount(), fixedSide: 'sell', paymentDate: futurePaymentDate(), paymentType: 'REGULAR' }
  }

  if (endpoint.id === 'instruction-create') {
    return { instructionType: 'PAYMENT', ...randomItem(currencyPairs), sellAmount: randomAmount(), fixedSide: 'sell', paymentDate: futurePaymentDate(), paymentType: 'REGULAR', beneficiaryId: 'BEN-001', reference: uniqueReference('PAY') }
  }

  if (endpoint.id === 'beneficiary-create') {
    const beneficiary = randomItem(beneficiaryProfiles)
    return { ...beneficiary, accountNumber: accountNumber(), paymentType: 'REGULAR' }
  }

  return endpoint.sample
}
