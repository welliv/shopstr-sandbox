import { useState } from "react";
import { Zap, Loader2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { BalanceBadge, PreimageProof, EventVerifyLink, RelayVerifyBadge } from "@/components/nostr/verification-badges";
import { refreshBalance, verifyEventOnRelay } from "@/lib/verification";
import { useNostrStore, useWalletStore, useTransactionStore } from "@/stores";
import { buildZapRequest } from "@/lib/nostr";
import { LightningAddress } from "@getalby/lightning-tools";

interface ZapEntry { amount: number; comment: string; senderNpub: string; }
let zaps: ZapEntry[] = [];
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

export function NostrZapsScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ZapPanel />
      <ZapFeedPanel />
    </div>
  );
}

function ZapPanel() {
  const [amount, setAmount] = useState("1000");
  const [comment, setComment] = useState("Great candle! 5 stars ⚡");
  const [lnAddress, setLnAddress] = useState("alice@getalby.com");
  const [isZapping, setIsZapping] = useState(false);
  const [zapResult, setZapResult] = useState<{preimage: string; eventId: string} | null>(null);
  const [eventVerified, setEventVerified] = useState<boolean | undefined>(undefined);

  const { getPrivateKey, getIdentity, publishNostrEvent } = useNostrStore();
  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const senderIdentity = getIdentity("buyer");

  const handleZap = async () => {
    const privkey = getPrivateKey("buyer");
    const client = getNWCClient("bob");
    if (!privkey || !client || !senderIdentity) return;
    setIsZapping(true);
    try {
      // Build NIP-57 zap request event
      const recipientPubkey = getIdentity("merchant")?.publicKey ?? "0".repeat(64);
      const zapReq = buildZapRequest(recipientPubkey, parseInt(amount) * 1000, comment, privkey);

      // Fetch invoice from LNURL
      const ln = new LightningAddress(lnAddress);
      await ln.fetch();
      const invoice = await ln.requestInvoice({ satoshi: parseInt(amount), comment });

      // Pay via NWC
      const payResult = await client.payInvoice({ invoice: invoice.paymentRequest });

      // Refresh balances after payment
      refreshBalance('bob');
      refreshBalance('alice');
      const preimage = payResult.preimage ?? "";

      // Publish kind 9735 receipt (simulated — real receipt comes from LNURL server)
      const { event } = await publishNostrEvent("buyer", {
        kind: 9735,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", recipientPubkey], ["preimage", preimage], ["description", JSON.stringify(zapReq)]],
        content: "",
      });

      // Verify event on relay
      setZapResult({ preimage, eventId: event.id });
      const verified = await verifyEventOnRelay(event.id, senderIdentity.publicKey, 9735);
      setEventVerified(verified);

      zaps = [{ amount: parseInt(amount), comment, senderNpub: senderIdentity.npub }, ...zaps];
      notify();
      addTransaction({ type: "nostr_zap_sent", status: "success", description: `Zap: ${amount} sats to ${lnAddress}` });
      addFlowStep({ fromWallet: "buyer", toWallet: "merchant", label: `⚡ ${amount} sats zap`, direction: "right", status: "success" });
    } catch (e) {
      addTransaction({ type: "nostr_zap_sent", status: "error", description: String(e) });
    } finally {
      setIsZapping(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <div className="flex gap-2">
        <BalanceBadge walletId="bob" label="Bob" />
        <BalanceBadge walletId="alice" label="Alice" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-yellow-500" /> Send Zap (NIP-57)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Lightning Address</label>
            <Input value={lnAddress} onChange={e => setLnAddress(e.target.value)} placeholder="alice@getalby.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Amount (sats)</label>
            <div className="flex gap-1">
              {[100, 500, 1000, 5000].map(n => (
                <button key={n} onClick={() => setAmount(String(n))} className={`flex-1 py-1 text-xs rounded border ${amount === String(n) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Comment</label>
            <Input value={comment} onChange={e => setComment(e.target.value)} />
          </div>
          <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            A zap is a Lightning payment + a signed kind 9734 event. The kind 9735 receipt proves real sats moved — not a free "like".
          </div>
          <Button className="w-full" onClick={handleZap} disabled={!senderIdentity || isZapping}>
            {isZapping ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Zapping...</> : <><Zap className="mr-2 h-4 w-4" />Zap {amount} sats</>}
          </Button>
          {zapResult && (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-2 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">⚡ Zap Proof</span>
                <RelayVerifyBadge verified={eventVerified} />
              </div>
              <PreimageProof preimage={zapResult.preimage} paymentHash="" />
              {zapResult.eventId && (
                <EventVerifyLink eventId={zapResult.eventId} label="verify kind 9735 on njump" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ZapFeedPanel() {
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; });
  const totalZapped = zaps.reduce((s, z) => s + z.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><Heart className="h-4 w-4" /> Zap Feed</CardTitle>
      </CardHeader>
      <CardContent>
        {zaps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No zaps yet. Send one on the left.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded bg-yellow-500/5 border border-yellow-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{totalZapped.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">total sats zapped</p>
            </div>
            {zaps.map((z, i) => (
              <div key={i} className="flex items-start gap-3 rounded border p-3">
                <Zap className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{z.amount} sats</Badge>
                    <span className="text-xs text-muted-foreground font-mono truncate">{z.senderNpub.slice(0, 16)}...</span>
                  </div>
                  <p className="text-sm">{z.comment}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
