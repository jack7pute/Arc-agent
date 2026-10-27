export const CANCELLED = 'cancelled'

export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

/** Turns wallet / RPC errors into short, actionable copy. Returns CANCELLED when the user dismissed the prompt. */
export function parseOnchainError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const message = raw.toLowerCase()
  const code = (error as { code?: number } | null)?.code
  if (code === 4001 || message.includes('user rejected') || message.includes('user denied')) return CANCELLED
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Not enough USDC for gas. Use "Get test USDC" in the sidebar, then try again.'
  }
  if (message.includes('reverted')) return 'The transaction was rejected by the contract.'
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return 'Network issue. Check your connection and retry.'
  }
  return 'Something went wrong. Please try again.'
}
