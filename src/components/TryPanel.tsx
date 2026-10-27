import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Loader2 } from 'lucide-react'
import { getChain } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ARC_TESTNET_CHAIN_ID } from '@/lib/registry'
import { shortAddress } from '@/lib/format'
import { OFFERS, apiBaseFromEndpoint } from '@/lib/offers'
import type { AgentOffer } from '@/lib/offers'
import type { useAgent } from '@/hooks/useAgent'
import { CopyButton, Label, StepCard } from './ui'

type Agent = ReturnType<typeof useAgent>

interface Requirement {
  network: string
  amount: string
  payTo: string
}

interface ProbeResult {
  httpStatus: number
  requirements: Requirement[]
  note?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toAmountString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '0'
}

async function readRequirements(response: Response): Promise<Requirement[]> {
  let data: unknown
  const header = response.headers.get('payment-required')
  if (header) {
    try {
      data = JSON.parse(atob(header))
    } catch {
      data = undefined
    }
  }
  if (!data) data = await response.json().catch(() => undefined)
  if (!isRecord(data) || !Array.isArray(data.accepts)) return []
  const seen = new Set<string>()
  const requirements: Requirement[] = []
  for (const entry of data.accepts.filter(isRecord)) {
    const network = typeof entry.network === 'string' ? entry.network : 'unknown'
    if (seen.has(network)) continue
    seen.add(network)
    requirements.push({
      network,
      amount: toAmountString(entry.amount ?? entry.maxAmountRequired),
      payTo: typeof entry.payTo === 'string' ? entry.payTo : '',
    })
  }
  // Arc Testnet first: that is where this agent lives.
  const arcNetwork = `eip155:${ARC_TESTNET_CHAIN_ID}`
  return requirements.sort((a, b) => Number(b.network === arcNetwork) - Number(a.network === arcNetwork))
}

function networkLabel(network: string): string {
  const chainId = Number(network.split(':')[1])
  return (Number.isInteger(chainId) ? getChain(chainId)?.name : undefined) ?? network
}

export function TryPanel({ agent, live }: { agent: Agent; live: boolean }) {
  const { address } = useAccount()
  const [offerId, setOfferId] = useState<AgentOffer['id']>('wallet-report')
  const [agentIdInput, setAgentIdInput] = useState('')
  const [addressInput, setAddressInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProbeResult>()

  const offer = OFFERS.find((item) => item.id === offerId) ?? OFFERS[0]
  const paramValue =
    offer.param === 'address' ? addressInput || address || '' : agentIdInput || agent.agentId?.toString() || ''
  const paramValid = offer.param === 'address' ? /^0x[0-9a-fA-F]{40}$/.test(paramValue) : /^\d+$/.test(paramValue)

  const apiBase = apiBaseFromEndpoint(agent.card?.services?.[0]?.endpoint) ?? `${window.location.origin}/api`
  const paidUrl = `${apiBase}${offer.path}?${offer.param}=${encodeURIComponent(paramValue)}`
  const buyCommand = `BUYER_PRIVATE_KEY=0x... bun run buy "${paidUrl}" --deposit 1`

  const probe = async () => {
    setLoading(true)
    setResult(undefined)
    try {
      const response = await fetch(`/api${offer.path}?${offer.param}=${encodeURIComponent(paramValue)}`)
      if (response.status === 402) {
        setResult({ httpStatus: 402, requirements: await readRequirements(response) })
      } else {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        setResult({ httpStatus: response.status, requirements: [], note: body.error })
      }
    } catch {
      setResult({ httpStatus: 0, requirements: [], note: 'Could not reach the agent API.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <StepCard index={3} title="Try it as a buyer" locked={!live}>
      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-[var(--surface-muted)] p-1">
        {OFFERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === offerId}
            onClick={() => {
              setOfferId(item.id)
              setResult(undefined)
            }}
            className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${
              item.id === offerId ? 'bg-white shadow-sm' : 'text-[var(--muted)]'
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>

      <label className="block">
        <Label>{offer.param === 'address' ? 'Wallet address to inspect' : 'Agent id to check'}</Label>
        <input
          className="field mono tabular-nums"
          value={paramValue}
          onChange={(event) =>
            offer.param === 'address' ? setAddressInput(event.target.value.trim()) : setAgentIdInput(event.target.value.replace(/\D/g, ''))
          }
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={!live || !paramValid || loading} onClick={() => void probe()}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          Request without paying
        </button>
        <span className="text-xs text-[var(--muted)]">Shows the live 402 challenge a buyer receives.</span>
      </div>

      {result && (
        <div role="status" className="mt-4 rounded-2xl bg-[var(--surface-muted)] p-4 text-sm">
          <p className="font-semibold tabular-nums">
            {result.httpStatus === 402 ? 'HTTP 402 Payment Required' : `HTTP ${result.httpStatus || 'error'}`}
          </p>
          {result.note && <p className="mt-1 text-[var(--muted)]">{result.note}</p>}
          <ul className="mt-2 space-y-1.5">
            {result.requirements.slice(0, 4).map((requirement, index) => (
              <li key={`${requirement.network}-${index}`} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--ink-2)]">{networkLabel(requirement.network)}</span>
                <span className="tabular-nums">
                  {Amount.fromRaw(BigInt(requirement.amount || '0'), usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)).toFixed(3)} USDC to{' '}
                  <span className="mono text-xs">{requirement.payTo ? shortAddress(requirement.payTo) : 'seller'}</span>
                </span>
              </li>
            ))}
          </ul>
          {result.requirements.length > 4 && (
            <p className="mt-1.5 text-xs text-[var(--muted)]">+{result.requirements.length - 4} more accepted networks</p>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <Label>Pay for real from a funded test wallet</Label>
        <p className="mb-2 max-w-[65ch] text-xs text-pretty text-[var(--muted)]">
          Fund a throwaway buyer wallet with Arc Testnet USDC, then run this once. The first run deposits 1 USDC into Gateway so
          later calls are gasless. Each paid call shows up in the activity feed.
        </p>
        <div className="flex items-start gap-2">
          <code className="mono block min-w-0 flex-1 break-all rounded-xl bg-[var(--accent)] p-3 text-xs text-white">{buyCommand}</code>
          <CopyButton value={buyCommand} />
        </div>
      </div>
    </StepCard>
  )
}
