import { Receipt } from 'lucide-react'
import { formatUsdc } from '@/onchain-money'
import { shortAddress } from '@/lib/format'
import { OFFERS } from '@/lib/offers'
import type { PaymentRecord } from '@/lib/offers'

export function ActivityFeed({ payments }: { payments: PaymentRecord[] }) {
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="display mb-3 text-lg font-semibold">Paid calls</h2>
      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface-muted)] px-4 py-8 text-center">
          <Receipt size={22} className="text-[var(--subtle)]" />
          <p className="text-sm text-[var(--muted)]">No paid calls yet. Settled payments appear here as buyers use your agent.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {payments.slice(0, 8).map((payment) => (
            <li key={`${payment.at}-${payment.payer}`} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{OFFERS.find((offer) => offer.id === payment.offer)?.title ?? payment.offer}</p>
                <p className="mono truncate text-xs text-[var(--muted)]">
                  from {shortAddress(payment.payer)} · {new Date(payment.at).toLocaleTimeString()}
                </p>
              </div>
              <span className="display shrink-0 font-semibold tabular-nums text-[var(--success)]">+{formatUsdc(BigInt(payment.amount))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
