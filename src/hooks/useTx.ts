import { useCallback, useState } from 'react'
import type { Hash, TransactionReceipt } from 'viem'
import { arcTestnet } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi'
import { CANCELLED, parseOnchainError } from '@/lib/format'

export type TxStatus = 'idle' | 'wallet' | 'confirming' | 'success' | 'error'

/** Runs one wallet write on Arc Testnet: switch chain, sign, wait for the real receipt. */
export function useTx() {
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: arcTestnet.id })
  const [status, setStatus] = useState<TxStatus>('idle')
  const [hash, setHash] = useState<Hash>()
  const [error, setError] = useState<string>()

  const run = useCallback(
    async (submit: () => Promise<Hash>): Promise<TransactionReceipt | undefined> => {
      setError(undefined)
      setHash(undefined)
      try {
        if (chainId !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id })
        setStatus('wallet')
        const txHash = await submit()
        setHash(txHash)
        setStatus('confirming')
        if (!publicClient) throw new Error('network: no client')
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status === 'reverted') throw new Error('reverted')
        setStatus('success')
        return receipt
      } catch (caught) {
        const message = parseOnchainError(caught)
        if (message === CANCELLED) {
          setStatus('idle')
        } else {
          setError(message)
          setStatus('error')
        }
        return undefined
      }
    },
    [chainId, publicClient, switchChainAsync],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setHash(undefined)
    setError(undefined)
  }, [])

  return { status, hash, error, run, reset, busy: status === 'wallet' || status === 'confirming' }
}
