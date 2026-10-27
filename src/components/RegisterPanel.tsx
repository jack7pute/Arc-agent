import { useMemo, useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { arcTestnet } from 'viem/chains'
import { parseEventLogs } from 'viem'
import { useAccount, useWriteContract } from 'wagmi'
import { IDENTITY_REGISTRY, buildAgentCard, identityAbi, toDataUri } from '@/lib/registry'
import { OFFER_PATHS, apiBaseFromEndpoint } from '@/lib/offers'
import { useTx } from '@/hooks/useTx'
import type { useAgent } from '@/hooks/useAgent'
import { Label, StepCard, TxNotice } from './ui'

type Agent = ReturnType<typeof useAgent>

const DEFAULT_NAME = 'Arc Scout'
const DEFAULT_DESCRIPTION =
  'Pay-per-call onchain intelligence for Arc Testnet: wallet reports and ERC-8004 agent trust checks, paid in USDC over x402.'

export function RegisterPanel({ agent }: { agent: Agent }) {
  // Remount once the onchain card arrives so the form starts from what is stored.
  const formKey = `${agent.agentId?.toString() ?? 'new'}:${agent.tokenUri ? 'loaded' : 'pending'}`
  const tx = useTx()
  return <RegisterForm key={formKey} agent={agent} tx={tx} />
}

function RegisterForm({ agent, tx }: { agent: Agent; tx: ReturnType<typeof useTx> }) {
  const { isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const savedCard = agent.card
  const [name, setName] = useState(savedCard?.name || DEFAULT_NAME)
  const [description, setDescription] = useState(savedCard?.description || DEFAULT_DESCRIPTION)
  const [apiBase, setApiBase] = useState(
    apiBaseFromEndpoint(savedCard?.services?.[0]?.endpoint) ?? `${window.location.origin}/api`,
  )
  const [existingId, setExistingId] = useState('')

  const registered = agent.agentId !== undefined && !!agent.owner

  const baseValid = /^https?:\/\/[^\s]+$/.test(apiBase)
  const formValid = name.trim().length > 1 && description.trim().length > 4 && baseValid

  const expectedUri = useMemo(
    () => toDataUri(buildAgentCard({ name, description, apiBase, agentId: agent.agentId }, OFFER_PATHS)),
    [name, description, apiBase, agent.agentId],
  )
  const inSync = registered && agent.tokenUri === expectedUri

  const register = async () => {
    const receipt = await tx.run(() =>
      writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityAbi,
        functionName: 'register',
        args: [expectedUri],
        chainId: arcTestnet.id,
      }),
    )
    if (!receipt) return
    const [registeredLog] = parseEventLogs({ abi: identityAbi, eventName: 'Registered', logs: receipt.logs })
    if (registeredLog) agent.setAgentId(registeredLog.args.agentId)
  }

  const syncCard = async () => {
    if (agent.agentId === undefined) return
    const receipt = await tx.run(() =>
      writeContractAsync({
        address: IDENTITY_REGISTRY,
        abi: identityAbi,
        functionName: 'setAgentURI',
        args: [agent.agentId as bigint, expectedUri],
        chainId: arcTestnet.id,
      }),
    )
    if (receipt) await agent.refetch()
  }

  const useExisting = () => {
    if (/^\d+$/.test(existingId)) agent.setAgentId(BigInt(existingId))
  }

  return (
    <StepCard index={1} title="Register onchain identity" done={registered && agent.isMine}>
      {!isConnected ? (
        <div className="space-y-3">
          <p className="max-w-[65ch] text-sm text-pretty text-[var(--ink-2)]">
            Connect the wallet that will own the agent. It receives the ERC-8004 identity token and, by default, the payments.
          </p>
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button type="button" className="btn-primary" onClick={show}>
                Connect wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      ) : (
        <div className="space-y-4">
          {registered && !agent.isMine && (
            <p className="rounded-xl bg-[rgba(186,43,76,0.08)] px-3 py-2.5 text-sm text-[var(--danger)]">
              Agent #{agent.agentId?.toString()} belongs to another wallet. Switch wallets or use a different agent id.
            </p>
          )}
          {agent.notFound && (
            <p className="rounded-xl bg-[rgba(186,43,76,0.08)] px-3 py-2.5 text-sm text-[var(--danger)]">
              Agent #{agent.agentId?.toString()} does not exist in the registry.{' '}
              <button type="button" className="font-semibold underline" onClick={() => agent.setAgentId(undefined)}>
                Clear
              </button>
            </p>
          )}

          <label className="block">
            <Label>Agent name</Label>
            <input className="field" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block">
            <Label>Description</Label>
            <textarea
              className="field min-h-[84px] resize-y"
              value={description}
              maxLength={240}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="block">
            <Label>Public API URL</Label>
            <input
              className="field mono !text-[13px]"
              value={apiBase}
              inputMode="url"
              onChange={(event) => setApiBase(event.target.value.trim())}
            />
            <span className="mt-1.5 block text-xs text-[var(--muted)]">
              Buyers read this from your agent card. Point it at your deployed app, then sync the card.
            </span>
          </label>

          {registered && agent.isMine ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" disabled={tx.busy || inSync || !formValid} onClick={() => void syncCard()}>
                {inSync ? 'Agent card is up to date' : 'Update agent card'}
              </button>
              <span className="text-xs text-[var(--muted)]">Rewrites the card stored in your identity token.</span>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              disabled={tx.busy || !formValid || registered}
              onClick={() => void register()}
            >
              {tx.status === 'wallet' ? 'Confirm in wallet' : tx.status === 'confirming' ? 'Registering...' : 'Register agent'}
            </button>
          )}
          <TxNotice status={tx.status} hash={tx.hash} error={tx.error} />

          {agent.agentId === undefined && (
            <div className="border-t border-[var(--border)] pt-4">
              <Label>Already registered? Use an existing agent id</Label>
              <div className="flex gap-2">
                <input
                  className="field mono tabular-nums"
                  inputMode="numeric"
                  placeholder="e.g. 22"
                  value={existingId}
                  onChange={(event) => setExistingId(event.target.value.replace(/\D/g, ''))}
                />
                <button type="button" className="btn-ghost shrink-0" disabled={!existingId} onClick={useExisting}>
                  Load
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </StepCard>
  )
}
