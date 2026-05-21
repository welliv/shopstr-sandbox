/**
 * nostr-store.ts — Nostr identity and relay state management
 *
 * Separate from wallet-store (NWC connections) because Nostr keypairs
 * and Lightning wallets are different concepts with different lifecycles.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  generateIdentity,
  publishEvent,
  DEFAULT_RELAYS,
} from "@/lib/nostr";
import type { EventTemplate } from "nostr-tools";

import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export interface StoredIdentity {
  role: string;          // "merchant" | "buyer" | "arbitrator"
  label: string;         // Display name: "Alice (Merchant)"
  emoji: string;
  publicKey: string;
  npub: string;
  // privateKey stored as hex string for localStorage compatibility
  privateKeyHex: string;
}

interface NostrEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface NostrState {
  identities: Record<string, StoredIdentity>;
  publishedEvents: NostrEvent[];
  relays: string[];

  // Actions
  generateIdentityForRole: (role: string, label: string, emoji: string) => StoredIdentity;
  getIdentity: (role: string) => StoredIdentity | undefined;
  getPrivateKey: (role: string) => Uint8Array | undefined;
  publishNostrEvent: (
    role: string,
    template: EventTemplate
  ) => Promise<{ event: NostrEvent; relaysReached: number }>;
  clearEvents: () => void;
  clearAll: () => void;
}

export const useNostrStore = create<NostrState>()(
  persist(
    (set, get) => ({
      identities: {},
      publishedEvents: [],
      relays: DEFAULT_RELAYS,

      generateIdentityForRole: (role, label, emoji) => {
        const identity = generateIdentity();
        const stored: StoredIdentity = {
          role,
          label,
          emoji,
          publicKey: identity.publicKey,
          npub: identity.npub,
          privateKeyHex: bytesToHex(identity.privateKey),
        };
        set((state) => ({
          identities: { ...state.identities, [role]: stored },
        }));
        return stored;
      },

      getIdentity: (role) => {
        return get().identities[role];
      },

      getPrivateKey: (role) => {
        const id = get().identities[role];
        if (!id) return undefined;
        return hexToBytes(id.privateKeyHex);
      },

      publishNostrEvent: async (role, template) => {
        const privateKey = get().getPrivateKey(role);
        if (!privateKey) throw new Error(`No identity for role: ${role}`);

        const { event, result } = await publishEvent(
          template,
          privateKey,
          get().relays
        );

        set((state) => ({
          publishedEvents: [...state.publishedEvents, event as NostrEvent],
        }));

        return { event: event as NostrEvent, relaysReached: result.published };
      },

      clearEvents: () => set({ publishedEvents: [] }),

      clearAll: () =>
        set({ identities: {}, publishedEvents: [], relays: DEFAULT_RELAYS }),
    }),
    {
      name: "nostr-storage",
      partialize: (state) => ({
        identities: state.identities,
        relays: state.relays,
      }),
    }
  )
);
