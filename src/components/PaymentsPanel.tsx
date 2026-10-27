import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAddress } from 'viem'
import { useSignMessage } from 'wagmi'
import { activationMessage } from '@/lib/registry'
import { CANCELLED, parseOnchainError } from '@/lib/format'
import { OFFERS } from '@/lib/offers'
import type { AgentStatus } from '@/lib/offers'
import type { useAgent } from '@/hooks/useAgent'
import { parseAmount } from '@/onchain-money'
import { ARC_TESTNET_CHAIN_ID } from '@/lib/registry'
import { StepCard } from './ui'

type Agent = ReturnType<typeof useAgent>

class ApiError extends Error {}

export function PaymentsPanel({ agent, status }: { agent: Agent; status?: AgentStatus }) {
  const queryClient = useQueryClient()
  const { signMessageAsync } = useSignMessage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const ready = agent.agentId !== undefined && agent.isMine && !!agent.payTo
  const live = ready && !!status?.activated && status.agentId === agent.agentId?.toString()

  const activate = async () => {
    if (agent.agentId === undefined || !agent.payTo) return
    setBusy(true)
    setError(undefined)
    try {
      const issuedAt = new Date().toISOString()
      const payTo = getAddress(agent.payTo)
      const signature = await signMessageAsync({ message: activationMessage(agent.agentId, payTo, issuedAt) })
      const response = await fetch('/api/agent/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: agent.agentId.toString(), payTo, issuedAt, signature }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new ApiError(body.error ?? `Activation failed (${response.status})`)
      }
      await queryClient.invalidateQueries({ queryKey: ['agent-status'] })
    } catch (caught) {
      // Server messages are already user-facing; wallet errors go through the parser.
      const message = caught instanceof ApiError ? caught.message : parseOnchainError(caught)
      if (message !== CANCELLED) setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepCard index={2} title="Make it payable with x402" done={live} locked={!ready}>
      <p className="max-w-[65ch] text-sm text-pretty text-[var(--ink-2)]">
        Paid endpoints answer with HTTP 402 until a buyer attaches a USDC payment. Settlement is gasless through Circle Gateway
        and lands in your agent wallet.
      </p>

      <ul className="mt-4 divide-y divide-[var(--border)] rounded-2xl bg-[var(--surface-muted)]">
        {OFFERS.map((offer) => (
          <li key={offer.id} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{offer.title}</p>
              <p className="mt-0.5 text-sm text-pretty text-[var(--muted)]">{offer.description}</p>
              <p className="mono mt-1.5 text-xs text-[var(--subtle)]">GET /api{offer.path}</p>
            </div>
            <span className="display shrink-0 text-lg font-semibold tabular-nums">
              {parseAmount(ARC_TESTNET_CHAIN_ID, offer.price).toFixed(3)}
              <span className="ml-1 text-xs font-medium text-[var(--muted)]">USDC</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={!ready || busy || live} onClick={() => void activate()}>
          {live ? 'Payments are live' : busy ? 'Waiting for signature...' : 'Enable paid endpoints'}
        </button>
        {ready && !live && <span className="text-xs text-[var(--muted)]">You sign a free message. No transaction.</span>}
        {live && status?.payTo && (
          <span className="text-xs text-[var(--muted)]">
            Paying out to <span className="mono">{status.payTo.slice(0, 6)}...{status.payTo.slice(-4)}</span>
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-[rgba(186,43,76,0.08)] px-3 py-2.5 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      {!ready && <p className="mt-3 text-xs text-[var(--muted)]">Register your agent with the connected wallet first.</p>}
    </StepCard>
  )
}
