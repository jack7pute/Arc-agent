import { useQuery } from '@tanstack/react-query'
import type { AgentStatus, PaymentRecord } from '@/lib/offers'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`)
  if (!response.ok) throw new Error(`Agent API ${response.status}`)
  return (await response.json()) as T
}

export function useAgentStatus() {
  return useQuery({
    queryKey: ['agent-status'],
    queryFn: () => getJson<AgentStatus>('/agent/status'),
    refetchInterval: 15_000,
  })
}

export function usePayments() {
  return useQuery({
    queryKey: ['agent-payments'],
    queryFn: () => getJson<PaymentRecord[]>('/agent/payments'),
    refetchInterval: 5_000,
  })
}
