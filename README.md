# Shopstr Sandbox

Explore Nostr Commerce Scenarios — an interactive demo of how Lightning payments, Nostr protocols, and Bitcoin-native revenue models work on the [Shopstr](https://shopstr.app) marketplace.

**[Try it here](https://welliv.github.io/shopstr-lightning-playground)**

## What This Is

Shopstr Sandbox is an internal team tool for exploring and validating payment flows before committing engineering resources. Connect a test wallet, click through scenarios, and see how every piece of Shopstr's commerce stack works together.

## Scenarios

### Core Scenarios (How Shopstr Works)

| Scenario | What It Shows | NIPs | Revenue |
|----------|--------------|------|---------|
| 💸 **Marketplace Checkout** | Buyer discovers product → verifies seller identity → pays via Lightning or Cashu → order delivered via gift-wrap | NIP-01, 05, 23, 47, 59, 60 | — |
| 💰 **Platform Fee** | Wrapped invoices with same-payment-hash hold invoice. Non-custodial 1% fee extraction at the protocol level | NIP-47 | 1% per transaction |
| 🏪 **Seller Payout + Alerts** | Real-time NWC payment notifications + gift-wrapped DM backup. Instant seller alerts on every sale | NIP-47, 59 | — |
| 🔒 **Buyer Escrow** | Hold invoice locks funds until delivery confirmed. Settle on success, cancel on dispute, auto-refund on timeout | NIP-47 | — |
| 📢 **Zapvertising** | NIP-57 Lightning zaps for product visibility. Boosted listings rank higher. 5% platform fee on boost revenue | NIP-47, 57 | 5% of boost |

### Infrastructure (How Shopstr Earns from APIs)

| Scenario | What It Shows | Revenue |
|----------|--------------|---------|
| 🔐 **L402 API Payments** | Pay-per-call MCP API. No API keys, no accounts. Every HTTP request carries a Lightning payment | 1-10 sats/call |

## How Scenarios Connect

```
Marketplace Checkout (S1)
  │
  ├──▶ Platform Fee (S2) ──▶ Seller Payout (S3)
  ├──▶ Buyer Escrow (S4) ──▶ Seller Payout (S3)
  └──▶ Zapvertising (S5) ──▶ Marketplace Checkout (S1) [loop]

All data queryable via L402 API (S6)
```

## Revenue Streams

| Stream | Mechanism | Amount |
|--------|-----------|--------|
| Transaction fee | Wrapped invoices (same-hash hold invoice) | 1% of sale |
| API fee | L402 pay-per-call | 1-10 sats per API call |
| Boost fee | % of zapvertising boost amount | 5% of boost |

All Bitcoin-native. No Stripe. No fiat billing.

## NIPs Demonstrated

| NIP | What | Where |
|-----|------|-------|
| NIP-01 | Core protocol (signed events) | Implicit in every scenario |
| NIP-05 | DNS identity verification | Marketplace Checkout (seller badge) |
| NIP-23 | Product listings (kind 30018/30019) | Marketplace Checkout |
| NIP-44 | Encryption (v2) | Inside gift-wrap flows |
| NIP-47 | Nostr Wallet Connect | Core of all scenarios |
| NIP-57 | Lightning Zaps | Zapvertising |
| NIP-59 | Gift Wrap (encryption envelope) | Order delivery, notifications |
| NIP-60/61 | Cashu eCash / Nutzap | Marketplace Checkout (payment toggle) |
| HTTP 402 | Paid HTTP requests (L402) | L402 API Payments |

## Team Instructions

1. Open [sandbox](https://welliv.github.io/shopstr-lightning-playground)
2. Click "Connect Test Wallet" — creates a free test wallet in 5 seconds
3. Walk through "Marketplace Checkout" first (2 min)
4. Try "Platform Fee" — this is how we earn on transactions (3 min)
5. Try "Buyer Escrow" — this is buyer protection (3 min)
6. Try "Zapvertising" — this is how merchants get visibility (3 min)
7. Try "L402 API Payments" — this is how we earn from AI agents (3 min)

Come to the consensus meeting with opinions on:
- Which scenario should we build first?
- Should we charge for the MCP API now or later?
- Is escrow needed for v1 or can we ship without it?

## Development

```bash
yarn install
yarn dev
```

Build:

```bash
yarn build
```

## Tech Stack

- React 19 + TypeScript + Vite
- @getalby/sdk (NWC wallet connectivity)
- @getalby/lightning-tools (invoice decoding, Lightning Address, fiat, L402)
- @getalby/bitcoin-connect-react (wallet connection UI)
- Zustand (state management)
- Tailwind CSS 4 + shadcn/ui

## License

MIT

---

Built for the [Shopstr](https://shopstr.app) team.
