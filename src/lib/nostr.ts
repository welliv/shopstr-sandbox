/**
 * nostr.ts — Browser-native Nostr utilities for Shopstr Sandbox
 *
 * Uses nostr-tools directly (browser-compatible).
 * No node:fs, no node:crypto — everything runs client-side.
 */

import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  verifyEvent,
  nip44,
  type Event as NostrEvent,
  type EventTemplate,
} from "nostr-tools";
import type { Filter } from "nostr-tools/filter";
import { SimplePool } from "nostr-tools/pool";
import { npubEncode, nsecEncode, naddrEncode, decode } from "nostr-tools/nip19";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

// ── Default relays ────────────────────────────────────────────────────────────

export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

// ── Identity ──────────────────────────────────────────────────────────────────

export interface NostrIdentity {
  privateKey: Uint8Array;
  publicKey: string;
  npub: string;
  nsec: string;
}

export function generateIdentity(): NostrIdentity {
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    npub: npubEncode(publicKey),
    nsec: nsecEncode(privateKey),
  };
}

export function identityFromNsec(nsecInput: string): NostrIdentity | null {
  try {
    const decoded = decode(nsecInput);
    if (decoded.type !== "nsec") return null;
    const privateKey = decoded.data as Uint8Array;
    const publicKey = getPublicKey(privateKey);
    return {
      privateKey,
      publicKey,
      npub: npubEncode(publicKey),
      nsec: nsecInput,
    };
  } catch {
    return null;
  }
}

// ── Event publishing ──────────────────────────────────────────────────────────

export interface PublishResult {
  published: number;
  total: number;
  events: NostrEvent[];
}

const pool = new SimplePool();

export async function publishEvent(
  template: EventTemplate,
  privateKey: Uint8Array,
  relays: string[] = DEFAULT_RELAYS
): Promise<{ event: NostrEvent; result: PublishResult }> {
  const event = finalizeEvent(template, privateKey);

  if (!verifyEvent(event)) {
    throw new Error("Event signature invalid");
  }

  const promises = pool.publish(relays, event);
  const results = await Promise.allSettled(promises);
  const published = results.filter((r) => r.status === "fulfilled").length;

  return {
    event,
    result: { published, total: relays.length, events: [event] },
  };
}

export async function fetchEvents(
  filters: Filter[],
  relays: string[] = DEFAULT_RELAYS,
  timeoutMs = 5000
): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const sub = pool.subscribeMany(relays, filters, {
      onevent(event) {
        events.push(event);
      },
      oneose() {
        sub.close();
        resolve(events);
      },
    });
    setTimeout(() => {
      sub.close();
      resolve(events);
    }, timeoutMs);
  });
}

// ── NIP-01: Metadata (kind 0) ─────────────────────────────────────────────────

export async function publishProfile(
  profile: {
    name?: string;
    about?: string;
    picture?: string;
    lud16?: string;
    nip05?: string;
  },
  privateKey: Uint8Array,
  relays?: string[]
) {
  return publishEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profile),
    },
    privateKey,
    relays
  );
}

// ── NIP-99: Classified Listing (kind 30402) ───────────────────────────────────

export interface ListingData {
  dTag: string;
  title: string;
  summary: string;
  content: string;
  price: { amount: string; currency: string };
  type?: string;
  images?: string[];
  categories?: string[];
  expiresAt?: number;
  location?: string;
}

export function buildListingTemplate(data: ListingData): EventTemplate {
  const tags: string[][] = [
    ["d", data.dTag],
    ["title", data.title],
    ["summary", data.summary],
    ["price", data.price.amount, data.price.currency],
    ["type", data.type ?? "product"],
    ["published_at", String(Math.floor(Date.now() / 1000))],
  ];

  if (data.images) tags.push(...data.images.map((url) => ["image", url]));
  if (data.categories) tags.push(...data.categories.map((t) => ["t", t]));
  if (data.expiresAt) tags.push(["expiration", String(data.expiresAt)]);
  if (data.location) tags.push(["location", data.location]);

  return {
    kind: 30402,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: data.content,
  };
}

export async function publishListing(
  data: ListingData,
  privateKey: Uint8Array,
  relays?: string[]
) {
  const template = buildListingTemplate(data);
  const { event, result } = await publishEvent(template, privateKey, relays);
  const shareableLink = naddrEncode({
    kind: 30402,
    pubkey: getPublicKey(privateKey),
    identifier: data.dTag,
    relays: relays ?? DEFAULT_RELAYS,
  });
  return { event, result, shareableLink };
}

// ── NIP-59: Gift Wrap (3-layer encryption) ───────────────────────────────────

export function giftWrap(
  content: string,
  senderPrivkey: Uint8Array,
  recipientPubkey: string
): NostrEvent {
  // 1. Rumor — unsigned inner event
  const rumor: EventTemplate = {
    kind: 14,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", recipientPubkey]],
    content,
  };

  // 2. Seal — encrypt rumor with sender key
  const senderPubkey = getPublicKey(senderPrivkey);
  const rumorJson = JSON.stringify({ ...rumor, pubkey: senderPubkey, id: "" });
  const sealConversationKey = nip44.getConversationKey(senderPrivkey, recipientPubkey);
  const encryptedRumor = nip44.encrypt(rumorJson, sealConversationKey);

  const sealTemplate: EventTemplate = {
    kind: 13,
    created_at: jitteredTimestamp(),
    tags: [],
    content: encryptedRumor,
  };
  const seal = finalizeEvent(sealTemplate, senderPrivkey);

  // 3. Gift wrap — random ephemeral key, encrypt seal
  const ephemeralKey = generateSecretKey();
  const wrapConversationKey = nip44.getConversationKey(ephemeralKey, recipientPubkey);
  const encryptedSeal = nip44.encrypt(JSON.stringify(seal), wrapConversationKey);

  const wrapTemplate: EventTemplate = {
    kind: 1059,
    created_at: jitteredTimestamp(),
    tags: [["p", recipientPubkey]],
    content: encryptedSeal,
  };

  return finalizeEvent(wrapTemplate, ephemeralKey);
}

export function unwrapGiftWrap(
  wrap: NostrEvent,
  recipientPrivkey: Uint8Array
): { content: string; senderPubkey: string } {

  // Unwrap outer gift wrap
  const wrapConversationKey = nip44.getConversationKey(recipientPrivkey, wrap.pubkey);
  const sealJson = nip44.decrypt(wrap.content, wrapConversationKey);
  const seal = JSON.parse(sealJson) as NostrEvent;

  // Unwrap seal
  const sealConversationKey = nip44.getConversationKey(recipientPrivkey, seal.pubkey);
  const rumorJson = nip44.decrypt(seal.content, sealConversationKey);
  const rumor = JSON.parse(rumorJson);

  return { content: rumor.content, senderPubkey: seal.pubkey };
}

function jitteredTimestamp(): number {
  const now = Math.floor(Date.now() / 1000);
  const jitter = Math.floor(Math.random() * 172800); // up to 2 days back
  return now - jitter;
}

// ── NIP-05: DNS Verification ─────────────────────────────────────────────────

export async function verifyNip05(
  identifier: string,
  pubkey: string
): Promise<boolean> {
  try {
    const [name, domain] = identifier.split("@");
    if (!name || !domain) return false;
    const url = `https://${domain}/.well-known/nostr.json?name=${name}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.names?.[name] === pubkey;
  } catch {
    return false;
  }
}

// ── Trust Score (Fibonacci-weighted) ─────────────────────────────────────────

export interface TrustSignals {
  nip05Verified: boolean;
  hasExternalLinks: boolean;
  hasThirdPartyAssertions: boolean;
  hasVerifiedReviews: boolean;
  hasReceivedZaps: boolean;
  hasCleanReportHistory: boolean;
}

export const TRUST_WEIGHTS = {
  nip05Verified: 1,
  hasExternalLinks: 1,
  hasThirdPartyAssertions: 2,
  hasVerifiedReviews: 3,
  hasReceivedZaps: 5,
  hasCleanReportHistory: 8,
} as const;

export const MAX_TRUST_SCORE = 20;

export function computeTrustScore(signals: TrustSignals) {
  let score = 0;
  const breakdown: { signal: string; earned: number; weight: number }[] = [];

  const entries: [keyof TrustSignals, keyof typeof TRUST_WEIGHTS, string][] = [
    ["nip05Verified", "nip05Verified", "NIP-05 domain verification"],
    ["hasExternalLinks", "hasExternalLinks", "External identity links (NIP-39)"],
    ["hasThirdPartyAssertions", "hasThirdPartyAssertions", "Third-party assertions (NIP-85)"],
    ["hasVerifiedReviews", "hasVerifiedReviews", "Preimage-verified reviews"],
    ["hasReceivedZaps", "hasReceivedZaps", "Zap endorsements (NIP-57)"],
    ["hasCleanReportHistory", "hasCleanReportHistory", "Clean report history (NIP-56)"],
  ];

  for (const [signal, weightKey, label] of entries) {
    const weight = TRUST_WEIGHTS[weightKey];
    const earned = signals[signal] ? weight : 0;
    score += earned;
    breakdown.push({ signal: label, earned, weight });
  }

  const percentage = Math.round((score / MAX_TRUST_SCORE) * 100);
  let tier: "unknown" | "low" | "moderate" | "high" | "verified";
  if (score <= 1) tier = "unknown";
  else if (score <= 5) tier = "low";
  else if (score <= 10) tier = "moderate";
  else if (score <= 17) tier = "high";
  else tier = "verified";

  return { score, max: MAX_TRUST_SCORE, percentage, tier, breakdown };
}

// ── NIP-57: Zap Request (kind 9734) ──────────────────────────────────────────

export function buildZapRequest(
  recipientPubkey: string,
  amountMsats: number,
  comment: string,
  senderPrivkey: Uint8Array,
  relays: string[] = DEFAULT_RELAYS
): NostrEvent {
  const template: EventTemplate = {
    kind: 9734,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["p", recipientPubkey],
      ["amount", String(amountMsats)],
      ["relays", ...relays],
    ],
    content: comment,
  };
  return finalizeEvent(template, senderPrivkey);
}

// ── NIP-56: Report (kind 1984) ────────────────────────────────────────────────

export type ReportReason =
  | "nudity" | "malware" | "profanity" | "illegal"
  | "spam" | "impersonation" | "scam" | "other";

export async function publishReport(
  reportedPubkey: string,
  reason: ReportReason,
  comment: string,
  reporterPrivkey: Uint8Array,
  relays?: string[]
) {
  return publishEvent(
    {
      kind: 1984,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", reportedPubkey, reason]],
      content: comment,
    },
    reporterPrivkey,
    relays
  );
}

// ── NIP-22: Comment (kind 1111) ───────────────────────────────────────────────

export async function publishQuestion(
  listingEventId: string,
  listingAuthorPubkey: string,
  question: string,
  authorPrivkey: Uint8Array,
  relays?: string[]
) {
  return publishEvent(
    {
      kind: 1111,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["K", "30402"],
        ["E", listingEventId, (relays ?? DEFAULT_RELAYS)[0], listingAuthorPubkey],
        ["p", listingAuthorPubkey],
      ],
      content: question,
    },
    authorPrivkey,
    relays
  );
}

export async function publishAnswer(
  questionEventId: string,
  questionAuthorPubkey: string,
  answer: string,
  authorPrivkey: Uint8Array,
  relays?: string[]
) {
  return publishEvent(
    {
      kind: 1111,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["e", questionEventId, (relays ?? DEFAULT_RELAYS)[0], "reply"],
        ["p", questionAuthorPubkey],
      ],
      content: answer,
    },
    authorPrivkey,
    relays
  );
}

// ── Preimage verification ─────────────────────────────────────────────────────

export async function verifyPreimage(
  preimage: string,
  paymentHash: string
): Promise<boolean> {
  try {
    if (!preimage || !paymentHash) return false;
    const preimageBytes = hexToBytes(preimage);
    const hashBuffer = await crypto.subtle.digest("SHA-256", preimageBytes as any);
    const computedHash = bytesToHex(new Uint8Array(hashBuffer));
    return computedHash.toLowerCase() === paymentHash.toLowerCase();
  } catch {
    return false;
  }
}

// ── Event display helpers ─────────────────────────────────────────────────────

export function kindName(kind: number): string {
  const names: Record<number, string> = {
    0: "Metadata",
    1: "Text Note",
    3: "Contacts",
    6: "Repost",
    7: "Reaction",
    13: "Seal (NIP-59)",
    1059: "Gift Wrap (NIP-59)",
    1111: "Comment (NIP-22)",
    1984: "Report (NIP-56)",
    9734: "Zap Request (NIP-57)",
    9735: "Zap Receipt (NIP-57)",
    10002: "Relay List (NIP-65)",
    23194: "NWC Request (NIP-47)",
    23195: "NWC Response (NIP-47)",
    27235: "HTTP Auth (NIP-98)",
    30078: "App Data (kind 30078)",
    30382: "Trusted Assertion (NIP-85)",
    30402: "Classified Listing (NIP-99)",
    31990: "Handler Info / Review",
  };
  return names[kind] ?? `Kind ${kind}`;
}
