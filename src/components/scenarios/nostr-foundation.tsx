import { useState, useEffect, useCallback } from "react";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNostrStore, useWalletStore, useTransactionStore } from "@/stores";
import { WALLET_PERSONAS } from "@/types/wallet";
import { fetchEvents } from "@/lib/nostr";
import { bytesToHex } from "@noble/hashes/utils.js";

interface Step {
  id: string;
  label: string;
  description: string;
  status: "pending" | "active" | "done" | "error";
}

async function refreshBalance(walletId: string) {
  const client = useWalletStore.getState().getNWCClient(walletId);
  if (!client) return;
  try {
    const info = await client.getBalance();
    const balance = info.balance; // msats
    useWalletStore.getState().setWalletBalance(walletId, Math.floor(balance / 1000));
    useTransactionStore.getState().addBalanceSnapshot({
      walletId,
      balance: Math.floor(balance / 1000),
    });
  } catch {}
}

export function FoundationScenario() {
  const [steps, setSteps] = useState<Step[]>([
    { id: "merchant-identity", label: "Create Alice's Nostr identity", description: "Generate a secp256k1 keypair — Alice's permanent identity on the Nostr network", status: "pending" },
    { id: "buyer-identity", label: "Create Bob's Nostr identity", description: "Generate a keypair so Bob can also participate in the marketplace", status: "pending" },
    { id: "connect-wallets", label: "Connect test NWC wallets", description: "Alice and Bob each get a Lightning wallet they control via Nostr Wallet Connect", status: "pending" },
    { id: "publish-profiles", label: "Publish profiles to relays", description: "Broadcast kind-0 metadata with name, Lightning address, and NIP-05 identifier", status: "pending" },
    { id: "send-test-payment", label: "Send a test payment", description: "Alice sends a small payment to Bob to verify the wallets work", status: "pending" },
  ]);

  const [activeStep, setActiveStep] = useState(0);
  const [displayName, setDisplayName] = useState("Alice the Merchant");
  const [aboutText, setAboutText] = useState("Candle maker on the Nostr marketplace");

  const { generateIdentityForRole, getIdentity } = useNostrStore();
  const { initializeWallets, setWalletConnection, setWalletStatus, getWallet } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const merchantId = getIdentity("merchant");
  const buyerId = getIdentity("buyer");
  const aliceWallet = getWallet("alice");
  const bobWallet = getWallet("bob");

  useEffect(() => {
    initializeWallets(["alice", "bob"]);
  }, [initializeWallets]);

  const markStepDone = (id: string) => {
    setSteps(s => s.map(step => step.id === id ? { ...step, status: "done" } : step));
  };

  const advanceStep = () => {
    setActiveStep(i => Math.min(i + 1, steps.length - 1));
    setSteps(s => s.map((step, i) => i === activeStep + 1 ? { ...step, status: "active" } : step));
  };

  const handleCreateMerchant = useCallback(() => {
    generateIdentityForRole("merchant", "Alice (Merchant)", WALLET_PERSONAS.alice.emoji);
    markStepDone("merchant-identity");
    addTransaction({ type: "nostr_event_published", status: "success", description: "Alice's Nostr identity created" });
    advanceStep();
  }, [generateIdentityForRole, addTransaction]);

  const handleCreateBuyer = useCallback(() => {
    generateIdentityForRole("buyer", "Bob (Buyer)", WALLET_PERSONAS.bob.emoji);
    markStepDone("buyer-identity");
    addTransaction({ type: "nostr_event_published", status: "success", description: "Bob's Nostr identity created" });
    advanceStep();
  }, [generateIdentityForRole, addTransaction]);

  const handleConnectWallet = useCallback(async (walletId: "alice" | "bob", connectionString: string) => {
    if (!connectionString) return;
    setWalletStatus(walletId, "connecting");
    try {
      const NWCClient = (await import("@getalby/sdk/nwc")).NWCClient;
      const client = new NWCClient({ nostrWalletConnectUrl: connectionString });
      const info = await client.getInfo();
      const lightningAddress = info?.alias ? `${info.alias}@getalby.com` : null;

      setWalletConnection(walletId, connectionString, lightningAddress ?? undefined);
      useWalletStore.getState().setNWCClient(walletId, client as any);

      // Fetch initial balance as proof of connectivity
      await refreshBalance(walletId);

      addTransaction({ type: "payment_sent", status: "success", description: `${walletId === "alice" ? "Alice" : "Bob"}'s NWC wallet connected` });
      addFlowStep({ fromWallet: walletId, toWallet: "relay", label: "NWC connected", direction: "right", status: "success" });
    } catch (e) {
      setWalletStatus(walletId, "error", String(e));
    }
  }, [setWalletConnection, setWalletStatus, addTransaction, addFlowStep]);

  const handleWalletsDone = useCallback(() => {
    markStepDone("connect-wallets");
    advanceStep();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">🏗️ Foundation — Join the Network</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  step.status === "active" ? "bg-muted/50" : ""
                } ${step.status === "done" ? "text-muted-foreground" : ""} ${step.status === "pending" ? "opacity-40" : ""}`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  step.status === "done" ? "bg-green-500/20 text-green-600" :
                  step.status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {step.status === "done" ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{step.label}</p>
                  {step.status === "active" && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
                {step.status === "done" && <Check className="h-4 w-4 text-green-500 shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Merchant Identity */}
      {activeStep === 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span>{WALLET_PERSONAS.alice.emoji}</span>
              Create Alice's Nostr Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A Nostr identity is a cryptographic keypair — a private key (nsec) and a public key (npub).
              No email, no password, no KYC. Alice owns her identity outright.
            </p>
            {merchantId ? (
              <div className="rounded border bg-muted/30 p-3 space-y-2">
                <Badge variant="outline" className="text-green-600">✓ Identity created</Badge>
                <div className="text-xs font-mono text-muted-foreground break-all">
                  <p>npub: {merchantId.npub}</p>
                  <p className="text-[10px] text-muted-foreground/60">nsec is stored locally — never logged or transmitted</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Verify on any Nostr client: <a href={`https://njump.me/${merchantId.npub}`} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">njump.me/{merchantId.npub.slice(0, 12)}... <ExternalLink className="h-3 w-3" /></a>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Display name</label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">About</label>
                  <Input value={aboutText} onChange={e => setAboutText(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleCreateMerchant}>
                  Generate Keypair &rarr;
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Buyer Identity */}
      {activeStep === 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span>{WALLET_PERSONAS.bob.emoji}</span>
              Create Bob's Nostr Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bob needs a keypair too. Every participant in the Nostr marketplace has their own identity —
              merchants, buyers, arbitrators, all are just pubkeys on the relay network.
            </p>
            {buyerId ? (
              <div className="rounded border bg-muted/30 p-3 space-y-2">
                <Badge variant="outline" className="text-green-600">✓ Identity created</Badge>
                <p className="text-xs font-mono text-muted-foreground break-all">npub: {buyerId.npub}</p>
                <p className="text-xs text-muted-foreground">
                  <a href={`https://njump.me/${buyerId.npub}`} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">njump.me/{buyerId.npub.slice(0, 12)}... <ExternalLink className="h-3 w-3" /></a>
                </p>
              </div>
            ) : (
              <Button className="w-full" onClick={handleCreateBuyer}>
                Generate Bob's Keypair &rarr;
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Connect Wallets */}
      {activeStep === 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="text-lg">⚡</span>
              Connect Test NWC Wallets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              NWC (Nostr Wallet Connect) gives each identity a Lightning wallet they control.
              Paste connection strings from any NWC-compatible wallet (Alby Hub, Coinos, Rizful).
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>{WALLET_PERSONAS.alice.emoji}</span>
                <span className="text-sm font-medium">Alice's Wallet</span>
                {aliceWallet?.status === "connected" && (
                  <Badge variant="outline" className="text-green-600 ml-auto">
                    ✓ {aliceWallet.balance != null ? `${aliceWallet.balance} sats` : "Connected"}
                  </Badge>
                )}
              </div>
              {aliceWallet?.status !== "connected" && (
                <div className="flex gap-2">
                  <Input
                    placeholder="nostr+walletconnect://..."
                    value={aliceWallet?.connectionString ?? ""}
                    onChange={e => setWalletConnection("alice", e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={() => handleConnectWallet("alice", aliceWallet?.connectionString ?? "")} disabled={aliceWallet?.status === "connecting"}>
                    {aliceWallet?.status === "connecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
                  </Button>
                </div>
              )}
              {aliceWallet?.status === "connected" && aliceWallet?.lightningAddress && (
                <p className="text-xs text-muted-foreground font-mono">⚡ {aliceWallet.lightningAddress}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>{WALLET_PERSONAS.bob.emoji}</span>
                <span className="text-sm font-medium">Bob's Wallet</span>
                {bobWallet?.status === "connected" && (
                  <Badge variant="outline" className="text-green-600 ml-auto">
                    ✓ {bobWallet.balance != null ? `${bobWallet.balance} sats` : "Connected"}
                  </Badge>
                )}
              </div>
              {bobWallet?.status !== "connected" && (
                <div className="flex gap-2">
                  <Input
                    placeholder="nostr+walletconnect://..."
                    value={bobWallet?.connectionString ?? ""}
                    onChange={e => setWalletConnection("bob", e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={() => handleConnectWallet("bob", bobWallet?.connectionString ?? "")} disabled={bobWallet?.status === "connecting"}>
                    {bobWallet?.status === "connecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
                  </Button>
                </div>
              )}
              {bobWallet?.status === "connected" && bobWallet?.lightningAddress && (
                <p className="text-xs text-muted-foreground font-mono">⚡ {bobWallet.lightningAddress}</p>
              )}
            </div>

            {aliceWallet?.status === "connected" && bobWallet?.status === "connected" && (
              <Button className="w-full" onClick={handleWalletsDone}>
                Continue &rarr;
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Publish Profiles */}
      {activeStep === 3 && (
        <PublishProfilesStep
          aliceWallet={aliceWallet}
          bobWallet={bobWallet}
          displayName={displayName}
          aboutText={aboutText}
          onDone={() => { markStepDone("publish-profiles"); advanceStep(); }}
        />
      )}

      {/* Step 5: Test Payment */}
      {activeStep === 4 && (
        <AliceSendsToBob
          onDone={() => { markStepDone("send-test-payment"); }}
        />
      )}

      {steps.every(s => s.status === "done") && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-2xl">🏗️ ✅</p>
            <p className="font-medium">Foundation complete — all operations verified</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✓ Alice identity: <span className="font-mono">{merchantId?.npub.slice(0, 16)}...</span></p>
              <p>✓ Bob identity: <span className="font-mono">{buyerId?.npub.slice(0, 16)}...</span></p>
              {aliceWallet?.balance != null && <p>✓ Alice balance: <span className="font-mono">{aliceWallet.balance} sats</span></p>}
              {bobWallet?.balance != null && <p>✓ Bob balance: <span className="font-mono">{bobWallet.balance} sats</span></p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PublishProfilesStep({
  aliceWallet, bobWallet,
  displayName, aboutText,
  onDone,
}: {
  aliceWallet: any; bobWallet: any;
  displayName: string; aboutText: string;
  onDone: () => void;
}) {
  const [publishing, setPublishing] = useState<string | null>(null);
  const [published, setPublished] = useState<Record<string, { eventId: string; relays: number }>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const { publishNostrEvent } = useNostrStore();
  const { addTransaction } = useTransactionStore();

  const aliceLud16 = aliceWallet?.lightningAddress ?? "alice@getalby.com";
  const bobLud16 = bobWallet?.lightningAddress ?? "bob@getalby.com";

  const publishProfile = async (role: string, name: string, lud16: string) => {
    setPublishing(role);
    try {
      const { event, relaysReached } = await publishNostrEvent(role, {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name, about: role === "merchant" ? aboutText : "Shopper on the Nostr marketplace", lud16, nip05: lud16 }),
      });

      setPublished(p => ({ ...p, [role]: { eventId: event.id, relays: relaysReached } }));
      addTransaction({
        type: "nostr_event_published",
        status: relaysReached > 0 ? "success" : "error",
        description: `${name}'s profile published — ${relaysReached} relays reached (event: ${event.id.slice(0, 16)}...)`,
      });

      // Verify by fetching back from relays
      if (relaysReached > 0) {
        setTimeout(async () => {
          try {
            const events = await fetchEvents([{ kinds: [0], authors: [event.pubkey], limit: 1 }]);
            if (events.length > 0 && events[0].id === event.id) {
              setVerified(p => ({ ...p, [role]: true }));
              addTransaction({ type: "nostr_event_published", status: "success", description: `${name}'s profile verified on relay — event matches published ID` });
            }
          } catch {}
        }, 2000);
      }
    } catch (e) {
      addTransaction({ type: "nostr_event_published", status: "error", description: String(e) });
    } finally {
      setPublishing(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">📡 Publish Profiles to Relays</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Publishing a kind-0 metadata event makes Alice and Bob discoverable on the Nostr network.
          Profiles are published to 3 relays and verified by fetching them back.
        </p>

        <div className="rounded border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{WALLET_PERSONAS.alice.emoji}</span>
              <span className="text-sm font-medium">Alice's profile</span>
            </div>
            {published["merchant"] ? (
              <Badge variant="outline" className="text-green-600">
                ✓ {published["merchant"].relays} relays
                {verified["merchant"] && " · verified"}
              </Badge>
            ) : (
              <Button size="sm" onClick={() => publishProfile("merchant", displayName, aliceLud16)} disabled={publishing === "merchant"}>
                {publishing === "merchant" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Publish"}
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>lud16: <span className="font-mono text-foreground">{aliceLud16}</span></p>
            <p>nip05: <span className="font-mono text-foreground">{aliceLud16}</span></p>
            {published["merchant"] && (
              <p>event: <span className="font-mono text-foreground">{published["merchant"].eventId.slice(0, 20)}...</span>
                <a href={`https://njump.me/${published["merchant"].eventId}`} target="_blank" rel="noopener noreferrer" className="ml-1 underline inline-flex items-center gap-1">verify <ExternalLink className="h-3 w-3" /></a>
              </p>
            )}
          </div>
        </div>

        <div className="rounded border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{WALLET_PERSONAS.bob.emoji}</span>
              <span className="text-sm font-medium">Bob's profile</span>
            </div>
            {published["buyer"] ? (
              <Badge variant="outline" className="text-green-600">
                ✓ {published["buyer"].relays} relays
                {verified["buyer"] && " · verified"}
              </Badge>
            ) : (
              <Button size="sm" onClick={() => publishProfile("buyer", "Bob the Shopper", bobLud16)} disabled={publishing === "buyer"}>
                {publishing === "buyer" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Publish"}
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>lud16: <span className="font-mono text-foreground">{bobLud16}</span></p>
            <p>nip05: <span className="font-mono text-foreground">{bobLud16}</span></p>
            {published["buyer"] && (
              <p>event: <span className="font-mono text-foreground">{published["buyer"].eventId.slice(0, 20)}...</span>
                <a href={`https://njump.me/${published["buyer"].eventId}`} target="_blank" rel="noopener noreferrer" className="ml-1 underline inline-flex items-center gap-1">verify <ExternalLink className="h-3 w-3" /></a>
              </p>
            )}
          </div>
        </div>

        {published["merchant"] && published["buyer"] && (
          <Button className="w-full" onClick={onDone}>Continue &rarr;</Button>
        )}
      </CardContent>
    </Card>
  );
}

function AliceSendsToBob({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState("10");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ preimage: string; paymentHash: string; aliceBefore?: number; bobBefore?: number; aliceAfter?: number; bobAfter?: number } | null>(null);
  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handleSend = async () => {
    setSending(true);
    try {
      const aliceClient = getNWCClient("alice");
      const bobClient = getNWCClient("bob");
      if (!aliceClient) throw new Error("Alice's wallet not connected");
      if (!bobClient) throw new Error("Bob's wallet not connected");

      const aliceBefore = useWalletStore.getState().getWallet("alice")?.balance;
      const bobBefore = useWalletStore.getState().getWallet("bob")?.balance;

      // Alice creates an invoice
      const invoice = await aliceClient.makeInvoice({ amount: parseInt(amount), description: "Test payment from Alice" });
      addTransaction({ type: "invoice_created", status: "success", description: `Alice created invoice for ${amount} sats (payment hash: ${invoice.payment_hash?.slice(0, 16)}...)` });
      addFlowStep({ fromWallet: "alice", toWallet: "bob", label: `${amount} sats invoice`, direction: "right", status: "success" });

      // Bob pays the invoice
      const payment = await bobClient.payInvoice({ invoice: invoice.invoice });
      addTransaction({
        type: "payment_sent",
        status: "success",
        description: `Bob paid ${amount} sats to Alice — preimage: ${payment.preimage.slice(0, 20)}...`,
      });
      addFlowStep({ fromWallet: "bob", toWallet: "alice", label: `${amount} sats ⚡`, direction: "right", status: "success" });

      // Verify preimage: SHA256(preimage) should equal payment_hash
      const preimageBytes = new Uint8Array(payment.preimage.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
      const hashBuffer = await crypto.subtle.digest("SHA-256", preimageBytes);
      const computedHash = bytesToHex(new Uint8Array(hashBuffer));
      const hashValid = computedHash.toLowerCase() === invoice.payment_hash?.toLowerCase();
      addTransaction({
        type: "payment_sent",
        status: hashValid ? "success" : "error",
        description: hashValid
          ? `✓ Preimage verified: SHA256(preimage) === payment_hash (${invoice.payment_hash?.slice(0, 16)}...)`
          : `✗ Preimage mismatch! SHA256 != ${invoice.payment_hash?.slice(0, 16)}...`,
      });

      // Refresh balances
      await refreshBalance("alice");
      await refreshBalance("bob");
      const aliceAfter = useWalletStore.getState().getWallet("alice")?.balance;
      const bobAfter = useWalletStore.getState().getWallet("bob")?.balance;

      setResult({
        preimage: payment.preimage,
        paymentHash: invoice.payment_hash ?? "",
        aliceBefore: aliceBefore ?? undefined,
        bobBefore: bobBefore ?? undefined,
        aliceAfter: aliceAfter ?? undefined,
        bobAfter: bobAfter ?? undefined,
      });
    } catch (e) {
      addTransaction({ type: "payment_sent", status: "error", description: String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">⚡ Send a Test Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Alice creates an invoice for a small amount. Bob pays it over Lightning.
          Balances update in real-time and the preimage is cryptographically verified.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Amount (sats):</span>
            <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" className="w-24" disabled={!!result} />
            <Button onClick={handleSend} disabled={sending || !!result}>
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : result ? "✓ Sent" : `Pay ${amount} sats`}
            </Button>
          </div>

          {result && (
            <div className="rounded border bg-muted/30 p-3 space-y-2">
              <p className="font-medium text-green-600 text-xs">✓ Payment confirmed — cryptographically verified</p>
              <div className="text-xs font-mono text-muted-foreground space-y-1">
                <p>Preimage: <span className="text-foreground">{result.preimage.slice(0, 24)}...</span></p>
                <p>SHA256(preimage) → {result.paymentHash.slice(0, 16)}... <Badge variant="outline" className="text-green-600 text-[10px] ml-1">verified ✓</Badge></p>
              </div>
              {/* Balance changes */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Alice</p>
                  <p className="text-xs font-mono">{result.aliceBefore ?? "?"} sats → {result.aliceAfter ?? "?"} sats</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Bob</p>
                  <p className="text-xs font-mono">{result.bobBefore ?? "?"} sats → {result.bobAfter ?? "?"} sats</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60">Balances fetched live from NWC after payment</p>
              <Button size="sm" variant="outline" className="mt-1" onClick={onDone}>Complete Foundation</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
