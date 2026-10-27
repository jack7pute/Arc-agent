/**
 * Buyer test harness: pay one of the agent's x402 endpoints from a throwaway Arc Testnet wallet.
 *
 *   BUYER_PRIVATE_KEY=0x... bun run buy "<paid endpoint URL>" [--deposit 1]
 *
 * Fund the buyer wallet with Arc Testnet USDC first. A one-time Gateway deposit
 * (--deposit <usdc>) is needed before the first payment.
 */
import { GatewayClient } from '@circle-fin/x402-batching/client'

const privateKey = process.env.BUYER_PRIVATE_KEY
const args = process.argv.slice(2)
const url = args.find((arg) => arg.startsWith('http'))
const depositIndex = args.indexOf('--deposit')
const depositAmount = depositIndex >= 0 ? args[depositIndex + 1] : undefined

if (!privateKey?.startsWith('0x')) {
  console.error('Set BUYER_PRIVATE_KEY in your shell (a testnet-only key).')
  process.exit(1)
}
if (!url) {
  console.error('Usage: bun run buy "<paid endpoint URL>" [--deposit 1]')
  process.exit(1)
}

const client = new GatewayClient({ chain: 'arcTestnet', privateKey: privateKey as `0x${string}` })
console.log(`Buyer ${client.address}`)

if (depositAmount) {
  console.log(`Depositing ${depositAmount} USDC into Gateway...`)
  await client.deposit(depositAmount)
}

const balances = await client.getBalances()
console.log(`Wallet ${balances.wallet.formatted} USDC, Gateway available ${balances.gateway.formattedAvailable} USDC`)

const result = await client.pay(url)
console.log(`Paid ${result.formattedAmount} USDC (status ${result.status}, settlement ${result.transaction})`)
console.log(JSON.stringify(result.data, null, 2))
