import { ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { formatUsdc } from '@/onchain-money'
import { ARC_TESTNET_CHAIN_ID } from '@/lib/registry'
import { shortAddress } from '@/lib/format'
import type { AgentStatus, PaymentRecord } from '@/lib/offers'
import type { useAgent } from '@/hooks/useAgent'

type Agent = ReturnType<typeof useAgent>

function Chip({ on, children }: { on: boolean; children: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        on ? 'bg-[rgba(26,128,71,0.12)] text-[var(--success)]' : 'bg-[var(--surface-muted)] text-[var(--subtle)]'
      }`}
    >
      {children}
    </span>
  )
}

function Row({ label, address }: { label: string; address?: string }) {
  if (!address) return null
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <a
        href={buildAddressExplorerUrl(ARC_TESTNET_CHAIN_ID, address)}
        target="_blank"
        rel="noopener noreferrer"
        className="mono inline-flex items-center gap-1 text-[13px] tabular-nums underline-offset-2 hover:underline"
      >
        {shortAddress(address)} <ExternalLink size={12} />
      </a>
    </div>
  )
}

export function AgentCard({
  agent,
  status,
  payments,
}: {
  agent: Agent
  status?: AgentStatus
  payments: PaymentRecord[]
}) {
  const registered = agent.agentId !== undefined && !!agent.owner
  const live = registered && !!status?.activated && status.agentId === agent.agentId?.toString()
  const earned = payments.reduce((sum, payment) => sum + BigInt(payment.amount), 0n)
  const name = agent.card?.name?.trim() || (registered ? `Agent #${agent.agentId}` : 'Your agent')
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <section className="glass rounded-3xl p-6">
      <div className="flex items-start gap-4">
        <div className="display flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-semibold text-white">
          {registered ? initials : '?'}
        </div>
        <div className="min-w-0">
          <h1 className="display truncate text-2xl font-semibold">{name}</h1>
          <p className="mt-0.5 text-sm tabular-nums text-[var(--muted)]">
            {registered ? `ERC-8004 agent #${agent.agentId} on Arc Testnet` : 'Not registered yet'}
          </p>
        </div>
      </div>

      {agent.card?.description && (
        <p className="mt-4 max-w-[65ch] text-sm text-pretty text-[var(--ink-2)]">{agent.card.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip on={registered}>Identity</Chip>
        <Chip on={live}>x402 payable</Chip>
        <Chip on={agent.feedbackCount > 0}>
          {agent.feedbackCount > 0 ? `${agent.feedbackCount} feedback` : 'No feedback yet'}
        </Chip>
      </div>

      {registered && (
        <div className="mt-5 space-y-2 rounded-2xl bg-[var(--surface-muted)] p-4">
          <Row label="Owner" address={agent.owner} />
          <Row label="Payout wallet" address={agent.payTo} />
        </div>
      )}

      <div className="mt-5 flex items-end justify-between rounded-2xl bg-[var(--accent)] p-4 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">Earned from paid calls</p>
          <p className="display mt-1 text-3xl font-semibold tabular-nums">{formatUsdc(earned)}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80">
          <TokenUSDC variant="branded" size={20} />
          <span className="tabular-nums">{payments.length} calls</span>
        </div>
      </div>
    </section>
  )
}
