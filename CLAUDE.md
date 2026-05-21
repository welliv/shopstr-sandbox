# Shopstr Commerce Sandbox — Development Guide

## Project Overview

Educational Nostr Commerce + Lightning demo. Users explore all 22 Nostr commerce scenarios (identity, listings, payments, escrow, reviews, Q&A, reports, zaps, subscriptions, carts, fees, L402, notifications, disputes) alongside 19 inherited Alby Lightning scenarios.

Forked from https://github.com/getAlby/sandbox — all Lightning scenarios kept intact.

## Architecture

- Package Manager: Yarn
- Frontend: React 19 + TypeScript + Vite
- UI: Shadcn/ui (Radix primitives)
- Styling: Tailwind CSS v4
- State: Zustand (7 stores)
- Lightning: Nostr Wallet Connect (NWC) via @getalby/sdk
- Nostr: nostr-tools (browser-native — no node:fs, no node:crypto)
- Visualization: Log, Flow Diagram, Balance Chart, Nostr Events, Code, Prompts, Production

## Stores

- `wallet-store.ts` — NWC connections, balances, NWCClient instances
- `nostr-store.ts` — Nostr keypair identities per role (merchant/buyer/arbitrator)
- `scenario-store.ts` — current scenario
- `transaction-store.ts` — tx log, flow steps, balance history
- `hold-invoice-store.ts` — shared hold invoice state
- `wrapped-invoice-store.ts` — shared wrapped invoice state
- `ui-store.ts` — active visualization tab

## Scenario Sections

- `scenarios` — Lightning scenarios (19 Alby scenarios, unchanged)
- `nostr` — Nostr Commerce scenarios (22 new scenarios)
- `402` — L402/402 scenarios (3 Alby scenarios, unchanged)
- `bitcoin-connect` — Bitcoin Connect scenarios (3 Alby scenarios, unchanged)

## Nostr Scenario Pattern

Every Nostr scenario:
1. Entry in `src/data/nostr-scenarios.ts`
2. Component in `src/components/scenarios/nostr/nostr-*.tsx`
3. Exported from `src/components/scenarios/nostr/index.ts`
4. Case in `src/components/scenario-panel.tsx`
5. Uses NostrIdentityCard from `src/components/nostr/`
6. Fires to useTransactionStore and useNostrStore

## Nostr Identities

Nostr scenarios use keypairs, not NWC connections. The useNostrStore manages them:
- generateIdentityForRole(role, label, emoji) — generates + persists keypair
- getPrivateKey(role) — returns Uint8Array for signing
- publishNostrEvent(role, template) — signs + publishes to relays

Roles: merchant, buyer, arbitrator, reporter, seller

## Key Libraries

- `src/lib/nostr.ts` — browser-native Nostr utilities (identity, publish, NIP-59 gift wrap, NIP-05, trust score, zap requests, reports, Q&A, preimage verification)
- `nostr-tools` — core Nostr protocol (generateSecretKey, finalizeEvent, verifyEvent, nip44, SimplePool)
- `@getalby/lightning-tools` — LightningAddress for LNURL payments and zaps

## Commands

- `yarn dev` — start dev server
- `yarn typecheck` — TypeScript check
- `yarn build` — full build
- `yarn lint` — ESLint
