# Arc Agent

An onchain agent on Arc Testnet. You register its identity with ERC-8004, then sell its services per call in USDC over x402. Buyers get an HTTP 402 challenge, pay without gas through Circle Gateway, and the money lands in the agent's wallet.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Register an agent identity from your wallet and keep its public agent card up to date.
- Switch on paid endpoints by signing one free message.
- Sell two services: a wallet report ($0.01) and an agent trust check ($0.005).
- See the live 402 challenge a buyer receives, and watch paid calls and earnings appear.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit, Express, `@circle-fin/x402-batching`.

## Development

Prerequisites: [Bun](https://bun.sh), a browser wallet, and Arc Testnet USDC for gas (get it at https://faucet.circle.com).

```bash
bun install
bun run server   # API on :3001 (paid endpoints, activation)
bun run dev      # app on :5173, proxies /api to the server
```

Other commands: `bun run check` (lint and typecheck), `bun run buy "<paid URL>" --deposit 1` (pay an endpoint from a test wallet).

### Environment variables

- `BUYER_PRIVATE_KEY`: testnet-only key used by `bun run buy`. Set it in your shell, never commit it.
- `AGENT_API_PORT`: API port, defaults to 3001. Optional.
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: optional outside Arc Studio. When absent the server uses the public Arc Testnet RPC.
