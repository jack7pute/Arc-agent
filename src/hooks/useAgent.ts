import { useCallback, useMemo, useState } from 'react'
import { arcTestnet } from 'viem/chains'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import {
  IDENTITY_REGISTRY,
  REPUTATION_REGISTRY,
  ZERO_ADDRESS,
  identityAbi,
  parseDataUri,
  reputationAbi,
} from '@/lib/registry'

const storageKey = (address: string) => `arc-agent:${address.toLowerCase()}`
const CLEARED = 'none'

/** The connected wallet's ERC-8004 agent: persisted id plus live registry reads. */
export function useAgent(serverAgentId?: string, serverOwner?: string) {
  const { address } = useAccount()
  const [, bump] = useState(0)

  // Persisted id for this wallet (localStorage), falling back to the agent the server is serving for this owner.
  const stored = address ? localStorage.getItem(storageKey(address)) : null
  let agentId: bigint | undefined
  if (stored && /^\d+$/.test(stored)) agentId = BigInt(stored)
  else if (!stored && address && serverAgentId && serverOwner?.toLowerCase() === address.toLowerCase()) agentId = BigInt(serverAgentId)

  const setAgentId = useCallback(
    (next: bigint | undefined) => {
      if (address) localStorage.setItem(storageKey(address), next === undefined ? CLEARED : next.toString())
      bump((tick) => tick + 1)
    },
    [address],
  )

  const enabled = agentId !== undefined
  const reads = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'ownerOf', args: [agentId ?? 0n], chainId: arcTestnet.id },
      { address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'tokenURI', args: [agentId ?? 0n], chainId: arcTestnet.id },
      { address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'getAgentWallet', args: [agentId ?? 0n], chainId: arcTestnet.id },
    ],
    query: { enabled },
  })

  const owner = reads.data?.[0]?.status === 'success' ? reads.data[0].result : undefined
  const tokenUri = reads.data?.[1]?.status === 'success' ? reads.data[1].result : undefined
  const walletOnchain = reads.data?.[2]?.status === 'success' ? reads.data[2].result : undefined

  const clients = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getClients',
    args: [agentId ?? 0n],
    chainId: arcTestnet.id,
    query: { enabled: enabled && owner !== undefined },
  })
  const clientList = clients.data
  const summary = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getSummary',
    args: [agentId ?? 0n, clientList ? [...clientList] : [], '', ''],
    chainId: arcTestnet.id,
    query: { enabled: enabled && !!clientList && clientList.length > 0 },
  })

  const card = useMemo(() => (tokenUri ? parseDataUri(tokenUri) : undefined), [tokenUri])
  const payTo = owner ? (walletOnchain && walletOnchain !== ZERO_ADDRESS ? walletOnchain : owner) : undefined
  const isMine = !!owner && !!address && owner.toLowerCase() === address.toLowerCase()
  const notFound = enabled && reads.isFetched && owner === undefined

  const refetch = useCallback(async () => {
    await reads.refetch()
  }, [reads])

  return {
    agentId,
    setAgentId,
    owner,
    tokenUri,
    card,
    payTo,
    isMine,
    notFound,
    loading: enabled && reads.isLoading,
    refetch,
    feedbackCount: summary.data ? Number(summary.data[0]) : 0,
  }
}
