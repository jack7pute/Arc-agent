import express from 'express'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { createPublicClient, erc20Abi, getAddress, http, isAddress } from 'viem'
import { arcTestnet } from 'viem/chains'
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server'
import type { GatewayMiddleware, PaymentRequest } from '@circle-fin/x402-batching/server'
import { requireChain, getUsdc } from '../src/onchain-facts'
import { formatUsdc } from '../src/onchain-money'
import {
  ARC_TESTNET_CHAIN_ID,
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
  ZERO_ADDRESS,
  activationMessage,
  identityAbi,
  parseDataUri,
  reputationAbi,
} from '../src/lib/registry'
import { OFFERS } from '../src/lib/offers'
import type { AgentOffer, AgentStatus, PaymentRecord } from '../src/lib/offers'
import { readJson, writeJson } from './store'

const PORT = Number(process.env.AGENT_API_PORT ?? 3001)
const FACILITATOR_URL = 'https://gateway-api-testnet.circle.com'
const ACTIVATION_MAX_AGE_MS = 10 * 60 * 1000
const MAX_PAYMENT_LOG = 100

// RPC: sandbox proxy when it covers Arc Testnet, otherwise the public endpoint from the facts module.
const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',')
const rpcUrl =
  process.env.RPC_PROXY_BASE_URL && proxyChains.includes('Arc_Testnet')
    ? `${process.env.RPC_PROXY_BASE_URL}/api/rpc/Arc_Testnet?_rpc_token=${process.env.RPC_PROXY_TOKEN ?? ''}`
    : requireChain(ARC_TESTNET_CHAIN_ID).rpcUrls[0]

const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) })
const usdcAddress = getUsdc(ARC_TESTNET_CHAIN_ID)?.address as `0x${string}`

interface AgentConfig {
  agentId: string
  owner: string
  payTo: string
  activatedAt: number
}

let config = await readJson<AgentConfig | null>('agent-config.json', null)
let payments = await readJson<PaymentRecord[]>('payments.json', [])
let gates: Record<AgentOffer['id'], RequestHandler> | undefined

function buildGates(payTo: string): Record<AgentOffer['id'], RequestHandler> {
  const gateway: GatewayMiddleware = createGatewayMiddleware({
    sellerAddress: payTo,
    facilitatorUrl: FACILITATOR_URL,
    description: 'Arc agent paid endpoint',
  })
  const entries = OFFERS.map((offer) => {
    const require = gateway.require(`$${offer.price}`)
    const handler: RequestHandler = (req, res, next) =>
      require(req as unknown as PaymentRequest, res as unknown as Parameters<typeof require>[1], next)
    return [offer.id, handler] as const
  })
  return Object.fromEntries(entries) as Record<AgentOffer['id'], RequestHandler>
}

if (config) gates = buildGates(config.payTo)

const app = express()
app.use(express.json({ limit: '16kb' }))

function status(): AgentStatus {
  return {
    activated: Boolean(config),
    agentId: config?.agentId,
    owner: config?.owner,
    payTo: config?.payTo,
    activatedAt: config?.activatedAt,
    facilitator: FACILITATOR_URL,
  }
}

app.get('/agent/status', (_req, res) => {
  res.json(status())
})

app.get('/agent/payments', (_req, res) => {
  res.json(payments)
})

async function readOwner(agentId: bigint): Promise<`0x${string}` | undefined> {
  try {
    return await publicClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: identityAbi,
      functionName: 'ownerOf',
      args: [agentId],
    })
  } catch {
    return undefined
  }
}

// Owner proves control of the agent by signing a short-lived message. First activation wins; after that only the current owner can change it.
app.post('/agent/activate', async (req, res) => {
  const body = req.body as { agentId?: string; signature?: string; issuedAt?: string; payTo?: string }
  if (!body.agentId || !/^\d{1,20}$/.test(body.agentId) || !body.signature || !body.issuedAt || !body.payTo) {
    res.status(400).json({ error: 'agentId, payTo, issuedAt and signature are required' })
    return
  }
  const issued = Date.parse(body.issuedAt)
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > ACTIVATION_MAX_AGE_MS) {
    res.status(400).json({ error: 'Signature expired. Sign again.' })
    return
  }
  const agentId = BigInt(body.agentId)
  const owner = await readOwner(agentId)
  if (!owner) {
    res.status(404).json({ error: `Agent #${body.agentId} is not registered` })
    return
  }
  if (config) {
    const currentOwner = await readOwner(BigInt(config.agentId))
    if (currentOwner && currentOwner.toLowerCase() !== owner.toLowerCase()) {
      res.status(403).json({ error: 'This server is already serving another agent owner' })
      return
    }
  }
  const walletOnchain = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: identityAbi,
    functionName: 'getAgentWallet',
    args: [agentId],
  })
  const payTo = walletOnchain === ZERO_ADDRESS ? owner : walletOnchain
  if (!isAddress(body.payTo) || getAddress(body.payTo) !== getAddress(payTo)) {
    res.status(400).json({ error: 'Pay-to address does not match the agent wallet onchain' })
    return
  }
  const valid = await publicClient.verifyMessage({
    address: owner,
    message: activationMessage(agentId, getAddress(payTo), body.issuedAt),
    signature: body.signature as `0x${string}`,
  })
  if (!valid) {
    res.status(401).json({ error: 'Signature does not match the agent owner' })
    return
  }
  config = { agentId: agentId.toString(), owner, payTo: getAddress(payTo), activatedAt: Date.now() }
  await writeJson('agent-config.json', config)
  gates = buildGates(config.payTo)
  res.json(status())
})

// Input checks run before the payment gate so a buyer is never charged for a request that cannot succeed.
function validateWallet(): RequestHandler {
  return (req, res, next) => {
    const address = typeof req.query.address === 'string' ? req.query.address : ''
    if (!isAddress(address)) {
      res.status(400).json({ error: 'Query parameter "address" must be a valid EVM address' })
      return
    }
    next()
  }
}

function validateAgent(): RequestHandler {
  return async (req, res, next) => {
    const raw = typeof req.query.agentId === 'string' ? req.query.agentId : ''
    if (!/^\d{1,20}$/.test(raw)) {
      res.status(400).json({ error: 'Query parameter "agentId" must be a non-negative integer' })
      return
    }
    if (!(await readOwner(BigInt(raw)))) {
      res.status(404).json({ error: `Agent #${raw} is not registered` })
      return
    }
    next()
  }
}

function gate(id: AgentOffer['id']): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!gates) {
      res.status(503).json({ error: 'Agent is not activated yet. The owner must switch on payments first.' })
      return
    }
    return gates[id](req, res, next)
  }
}

async function recordPayment(req: Request, offer: AgentOffer['id']): Promise<void> {
  const payment = (req as unknown as PaymentRequest).payment
  if (!payment) return
  payments = [
    {
      at: Date.now(),
      offer,
      payer: payment.payer,
      amount: payment.amount,
      network: payment.network,
      transaction: payment.transaction,
    },
    ...payments,
  ].slice(0, MAX_PAYMENT_LOG)
  await writeJson('payments.json', payments)
}

app.get('/agent/wallet-report', validateWallet(), gate('wallet-report'), async (req, res) => {
  const address = getAddress(req.query.address as string)
  const [balance, transactionCount, code, agentsHeld, blockNumber] = await Promise.all([
    publicClient.readContract({ address: usdcAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
    publicClient.getTransactionCount({ address }),
    publicClient.getCode({ address }),
    publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'balanceOf', args: [address] }),
    publicClient.getBlockNumber(),
  ])
  await recordPayment(req, 'wallet-report')
  res.json({
    network: 'Arc Testnet',
    address,
    usdcBalance: formatUsdc(balance),
    transactionCount,
    isContract: Boolean(code && code !== '0x'),
    erc8004AgentsHeld: Number(agentsHeld),
    asOfBlock: blockNumber.toString(),
  })
})

app.get('/agent/agent-check', validateAgent(), gate('agent-check'), async (req, res) => {
  const agentId = BigInt(req.query.agentId as string)
  const [owner, agentWallet, uri, clients] = await Promise.all([
    publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'ownerOf', args: [agentId] }),
    publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'getAgentWallet', args: [agentId] }),
    publicClient.readContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'tokenURI', args: [agentId] }),
    publicClient.readContract({ address: REPUTATION_REGISTRY, abi: reputationAbi, functionName: 'getClients', args: [agentId] }),
  ])
  let reputation: { feedbackCount: number; averageScore: string | null } = { feedbackCount: 0, averageScore: null }
  if (clients.length > 0) {
    const [count, summaryValue, decimals] = await publicClient.readContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: 'getSummary',
      args: [agentId, [...clients], '', ''],
    })
    reputation = {
      feedbackCount: Number(count),
      averageScore: count > 0n ? (Number(summaryValue) / 10 ** decimals).toString() : null,
    }
  }
  const card = parseDataUri(uri)
  await recordPayment(req, 'agent-check')
  res.json({
    network: 'Arc Testnet',
    agentId: agentId.toString(),
    owner,
    agentWallet: agentWallet === ZERO_ADDRESS ? null : agentWallet,
    card: card
      ? { name: card.name ?? null, active: card.active ?? null, x402Support: card.x402Support ?? false }
      : { uri: uri.slice(0, 200) },
    reputation,
  })
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[agent-api]', error instanceof Error ? error.message : error)
  if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
})

app.listen(PORT, () => {
  console.log(`[agent-api] listening on :${PORT} (RPC ${rpcUrl.split('?')[0]})`)
  console.log(`[agent-api] ${config ? `serving agent #${config.agentId}, payTo ${config.payTo}` : 'waiting for owner activation'}`)
})
