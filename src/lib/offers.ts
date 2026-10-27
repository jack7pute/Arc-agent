/** Paid endpoints the agent sells. Shared by the API server and the UI. */
export interface AgentOffer {
  id: 'wallet-report' | 'agent-check'
  /** Path under the API base (the dev proxy strips /api before it reaches the server). */
  path: string
  /** Price in USDC as a decimal string. */
  price: string
  title: string
  description: string
  param: 'address' | 'agentId'
}

export const OFFERS: readonly AgentOffer[] = [
  {
    id: 'wallet-report',
    path: '/agent/wallet-report',
    price: '0.01',
    title: 'Wallet report',
    description: 'USDC balance, activity count, contract flag and ERC-8004 agents held by any Arc Testnet address.',
    param: 'address',
  },
  {
    id: 'agent-check',
    path: '/agent/agent-check',
    price: '0.005',
    title: 'Agent trust check',
    description: 'Owner, payout wallet, card status and reputation feedback for any ERC-8004 agent id.',
    param: 'agentId',
  },
]

export const OFFER_PATHS = OFFERS.map((offer) => offer.path)

/** Recovers the API base URL from an endpoint stored in an agent card. */
export function apiBaseFromEndpoint(endpoint: string | undefined): string | undefined {
  if (!endpoint) return undefined
  return endpoint.endsWith(OFFERS[0].path) ? endpoint.slice(0, -OFFERS[0].path.length) : undefined
}

export interface PaymentRecord {
  at: number
  offer: AgentOffer['id']
  payer: string
  /** Smallest USDC unit (6 decimals) as a decimal string. */
  amount: string
  network: string
  transaction?: string
}

export interface AgentStatus {
  activated: boolean
  agentId?: string
  owner?: string
  payTo?: string
  activatedAt?: number
  facilitator: string
}
