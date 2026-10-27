# Arc Agent

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Registers an ERC-8004 agent identity on Arc Testnet and sells two endpoints per call over x402 (Circle Gateway Nanopayments).

- Identity registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, reputation registry `0x8004B663056A597Dffe9eCcC1965A193B7388713` (Arc Testnet, verified live).
- Agent card is stored onchain as a base64 data URI (`src/lib/registry.ts`). Update it with `setAgentURI` after deploying so the API URL is public.
- API server: `server/index.ts` (Express, port 3001), reached from the browser via the Vite `/api` proxy. Paid routes: `/agent/wallet-report`, `/agent/agent-check`. Catalog in `src/lib/offers.ts`.
- Activation: the agent owner signs a message, the server checks `ownerOf` and sets the payout to `getAgentWallet` (owner by default). Config persists in `data/agent-config.json` (gitignored). First owner wins.
- Gateway facilitator is testnet: `https://gateway-api-testnet.circle.com`. Mainnet needs explicit approval.
- Buyer test harness: `scripts/buy.ts`.
- No contracts of our own; registries are Circle's deployed ones.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
