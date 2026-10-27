import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import type { Hash } from 'viem'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ARC_TESTNET_CHAIN_ID } from '@/lib/registry'
import type { TxStatus } from '@/hooks/useTx'

export function StepCard({
  index,
  title,
  done,
  locked,
  children,
}: {
  index: number
  title: string
  done?: boolean
  locked?: boolean
  children: ReactNode
}) {
  return (
    <section className={`glass rounded-3xl p-5 sm:p-6 ${locked ? 'opacity-60' : ''}`}>
      <header className="mb-4 flex items-center gap-3">
        <span
          className={`display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
            done ? 'bg-[var(--success)] text-white' : 'bg-[var(--accent)] text-white'
          }`}
        >
          {done ? <Check size={16} aria-label="Done" /> : index}
        </span>
        <h2 className="display text-xl font-semibold text-balance">{title}</h2>
      </header>
      {children}
    </section>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--subtle)]">{children}</span>
}

export function TxNotice({ status, hash, error }: { status: TxStatus; hash?: Hash; error?: string }) {
  if (status === 'idle') return null
  return (
    <div
      role="status"
      className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 text-sm ${
        status === 'error' ? 'bg-[rgba(186,43,76,0.08)] text-[var(--danger)]' : 'bg-[var(--surface-muted)] text-[var(--ink-2)]'
      }`}
    >
      {status === 'wallet' && (
        <span className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Confirm in your wallet
        </span>
      )}
      {status === 'confirming' && (
        <span className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Waiting for confirmation on Arc
        </span>
      )}
      {status === 'success' && (
        <span className="flex items-center gap-2 text-[var(--success)]">
          <Check size={14} /> Confirmed onchain
        </span>
      )}
      {status === 'error' && <span>{error}</span>}
      {hash && (
        <a
          href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
        >
          View transaction <ExternalLink size={12} />
        </a>
      )}
    </div>
  )
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn-ghost inline-flex items-center gap-2 !min-h-9 !px-3 text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  )
}
