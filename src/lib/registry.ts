import { parseAbi } from 'viem'

/** ERC-8004 registries deployed on Arc Testnet (verified live at build time). */
export const ARC_TESTNET_CHAIN_ID = 5042002

export const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const
export const REPUTATION_REGISTRY = '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export const identityAbi = parseAbi([
  'function register(string agentURI) returns (uint256 agentId)',
  'function setAgentURI(uint256 agentId, string newURI)',
  'function tokenURI(uint256 agentId) view returns (string)',
  'function ownerOf(uint256 agentId) view returns (address)',
  'function getAgentWallet(uint256 agentId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
])

export const reputationAbi = parseAbi([
  'function getClients(uint256 agentId) view returns (address[])',
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
])

/** CAIP-10 style global identifier of the identity registry. */
export const AGENT_REGISTRY_ID = `eip155:${ARC_TESTNET_CHAIN_ID}:${IDENTITY_REGISTRY}`

export interface AgentProfileInput {
  name: string
  description: string
  /** Public base URL of the agent API, e.g. https://my-app.example/api */
  apiBase: string
  /** Known once the agent is registered; omitted from the first card. */
  agentId?: bigint
}

export interface AgentCardService {
  name: string
  endpoint: string
  version?: string
}

export interface AgentCard {
  type: string
  name: string
  description: string
  services: AgentCardService[]
  x402Support: boolean
  active: boolean
  registrations: { agentId: number; agentRegistry: string }[]
  supportedTrust: string[]
}

export function buildAgentCard(input: AgentProfileInput, endpoints: string[]): AgentCard {
  const base = input.apiBase.replace(/\/+$/, '')
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: input.name.trim(),
    description: input.description.trim(),
    services: endpoints.map((path) => ({ name: 'x402', endpoint: `${base}${path}`, version: '2' })),
    x402Support: true,
    active: true,
    registrations:
      input.agentId === undefined
        ? []
        : [{ agentId: Number(input.agentId), agentRegistry: AGENT_REGISTRY_ID }],
    supportedTrust: ['reputation'],
  }
}

/** Self-contained agent URI: the registration file lives in the token itself. */
export function toDataUri(card: AgentCard): string {
  const json = JSON.stringify(card)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:application/json;base64,${btoa(binary)}`
}

export function parseDataUri(uri: string): Partial<AgentCard> | undefined {
  const prefix = 'data:application/json;base64,'
  if (!uri.startsWith(prefix)) return undefined
  try {
    const binary = atob(uri.slice(prefix.length))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return typeof parsed === 'object' && parsed !== null ? (parsed) : undefined
  } catch {
    return undefined
  }
}

/** Message the agent owner signs to switch on paid endpoints for their agent. */
export function activationMessage(agentId: bigint, payTo: string, issuedAt: string): string {
  return [
    `Activate x402 payments for ERC-8004 agent #${agentId}`,
    `Registry: ${AGENT_REGISTRY_ID}`,
    `Pay to: ${payTo}`,
    `Issued: ${issuedAt}`,
  ].join('\n')
}
