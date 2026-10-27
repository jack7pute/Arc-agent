import { ConnectKitButton } from 'connectkit'
import { NetworkArc } from '@web3icons/react'
import { useAgent } from '@/hooks/useAgent'
import { useAgentStatus, usePayments } from '@/hooks/useAgentApi'
import { ActivityFeed } from '@/components/ActivityFeed'
import { AgentCard } from '@/components/AgentCard'
import { PaymentsPanel } from '@/components/PaymentsPanel'
import { RegisterPanel } from '@/components/RegisterPanel'
import { TryPanel } from '@/components/TryPanel'

export default function App() {
  const statusQuery = useAgentStatus()
  const paymentsQuery = usePayments()
  const status = statusQuery.data
  const payments = paymentsQuery.data ?? []
  const agent = useAgent(status?.agentId, status?.owner)
  const live = !!status?.activated && agent.agentId !== undefined && status.agentId === agent.agentId.toString()

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
            <NetworkArc variant="mono" size={20} />
          </span>
          <span className="display text-lg font-semibold">Arc Agent</span>
        </div>
        <ConnectKitButton showBalance={false} />
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-4 pb-24 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
          <AgentCard agent={agent} status={status} payments={payments} />
          <div className="hidden lg:block">
            <ActivityFeed payments={payments} />
          </div>
        </div>

        <div className="space-y-5">
          <RegisterPanel agent={agent} />
          <PaymentsPanel agent={agent} status={status} />
          <TryPanel agent={agent} live={live} />
          <div className="lg:hidden">
            <ActivityFeed payments={payments} />
          </div>
        </div>
      </main>
    </div>
  )
}
