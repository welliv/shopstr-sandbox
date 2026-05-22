import { bytesToHex } from "@noble/hashes/utils.js";
import { useWalletStore, useTransactionStore } from "@/stores";
import { fetchEvents } from "@/lib/nostr";

/**
 * Refresh a wallet's balance from NWC and record a snapshot.
 * Returns the new balance in sats, or null if unavailable.
 */
export async function refreshBalance(walletId: string): Promise<number | null> {
  const client = useWalletStore.getState().getNWCClient(walletId);
  if (!client) return null;
  try {
    const info = await client.getBalance();
    const balance = Math.floor((info.balance ?? 0) / 1000);
    useWalletStore.getState().setWalletBalance(walletId, balance);
    useTransactionStore.getState().addBalanceSnapshot({ walletId, balance });
    return balance;
  } catch {
    return null;
  }
}

/**
 * Refresh balances for multiple wallets in parallel.
 */
export async function refreshBalances(walletIds: string[]): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {};
  await Promise.all(
    walletIds.map(async (id) => {
      results[id] = await refreshBalance(id);
    })
  );
  return results;
}

/**
 * Verify that SHA256(preimage) === paymentHash.
 * Returns { valid: boolean, computedHash: string }.
 */
export async function verifyPreimageSha256(
  preimageHex: string,
  paymentHashHex: string
): Promise<{ valid: boolean; computedHash: string }> {
  try {
    const preimageBytes = new Uint8Array(
      preimageHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
    );
    const hashBuffer = await crypto.subtle.digest("SHA-256", preimageBytes);
    const computedHash = bytesToHex(new Uint8Array(hashBuffer));
    const valid = computedHash.toLowerCase() === paymentHashHex.toLowerCase();
    return { valid, computedHash };
  } catch {
    return { valid: false, computedHash: "" };
  }
}

/**
 * Verify an event on relays by fetching it back.
 * Tries for up to `timeoutMs` ms (polls every 2s).
 * Returns true if the event was found on at least one relay.
 */
export async function verifyEventOnRelay(
  eventId: string,
  pubkey: string,
  kind: number = 0,
  timeoutMs: number = 4000
): Promise<boolean> {
  const poll = async (): Promise<boolean> => {
    try {
      const events = await fetchEvents([
        { kinds: [kind], authors: [pubkey], limit: 5 },
      ]);
      return events.some((e: any) => e.id === eventId);
    } catch {
      return false;
    }
  };

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await poll();
    if (found) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return poll(); // final try
}

/**
 * Build an njump.me verification link for an event ID or naddr.
 */
export function eventVerifyLink(id: string): string {
  return `https://njump.me/${id}`;
}

/**
 * Format a hex string as a short display (first N chars + "...").
 */
export function shortHex(hex: string, chars: number = 16): string {
  if (!hex || hex.length <= chars) return hex || "";
  return `${hex.slice(0, chars)}...`;
}
