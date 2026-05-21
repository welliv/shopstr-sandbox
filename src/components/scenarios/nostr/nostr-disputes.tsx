import { useState } from "react";
import { Scale, Shield, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";
import { verifyPreimage } from "@/lib/nostr";

type Resolution = "buyer_wins" | "seller_wins" | "split" | null;

let sharedDispute: { paymentHash: string; reason: string; raised: boolean } | null = null;
let sharedResolution: Resolution = null;
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

export function NostrDisputesScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BuyerPanel />
      <ArbitratorPanel />
    </div>
  );
}

function BuyerPanel() {
  const [paymentHash, setPaymentHash] = useState("a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890");
  const [reason, setReason] = useState("Ordered lavender candles. Package arrived damaged — all 3 items broken. Photos attached.");
  const [isRaising, setIsRaising] = useState(false);

  const { getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const buyerIdentity = getIdentity("buyer");

  const handleRaise = async () => {
    setIsRaising(true);
    try {
      await publishNostrEvent("buyer", {
        kind: 1984,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["payment_hash", paymentHash], ["type", "dispute"], ["reason", "non-delivery"]],
        content: reason,
      });
      sharedDispute = { paymentHash, reason, raised: true };
      notify();
      addTransaction({ type: "nostr_dispute_raised", status: "success", description: "Dispute raised — kind 1984 published with payment hash" });
      addFlowStep({ fromWallet: "buyer", toWallet: "arbitrator", label: "kind 1984 dispute event", direction: "right", status: "success" });
    } catch (e) {
      addTransaction({ type: "nostr_dispute_raised", status: "error", description: String(e) });
    } finally {
      setIsRaising(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><AlertCircle className="h-4 w-4" /> Raise Dispute</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Payment hash (proof of payment)</label>
            <Input value={paymentHash} onChange={e => setPaymentHash(e.target.value)} className="font-mono text-xs" />
          </div>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Describe the issue..." />
          <Button className="w-full" onClick={handleRaise} disabled={isRaising || !buyerIdentity || !!sharedDispute}>
            {isRaising ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</> :
             sharedDispute ? "Dispute raised ✓" : "Raise Dispute (kind 1984)"}
          </Button>
          {sharedResolution && (
            <div className={`rounded border p-2 text-xs ${sharedResolution === "buyer_wins" ? "border-green-500/20 bg-green-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
              <p className="font-medium">Resolution: {sharedResolution.replace("_", " ")}</p>
              <p className="text-muted-foreground">Arbitrator's NIP-85 assertion is permanent on relays.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ArbitratorPanel() {
  const [_lnurlVerifyUrl, _setLnurlVerifyUrl] = useState("https://lnurlp.example.com/lnurl-verify/abc123");
  const [preimage, setPreimage] = useState("");
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; });

  const { getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handleVerify = async () => {
    if (!sharedDispute) return;
    setIsVerifying(true);
    // Verify preimage against payment hash
    const valid = preimage ? await verifyPreimage(preimage, sharedDispute.paymentHash) : false;
    setVerifyResult(valid);
    addTransaction({ type: "nostr_event_published", status: valid ? "success" : "error", description: valid ? "Payment verified: SHA256(preimage) === paymentHash ✓" : "Verification failed" });
    setIsVerifying(false);
  };

  const handleResolve = async (resolution: NonNullable<Resolution>) => {
    const arbitratorIdentity = getIdentity("arbitrator");
    if (!arbitratorIdentity || !sharedDispute) return;
    await publishNostrEvent("arbitrator", {
      kind: 30382,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", sharedDispute.paymentHash], ["resolution", resolution], ["payment_hash", sharedDispute.paymentHash]],
      content: `Dispute resolved: ${resolution}. Payment verified via preimage.`,
    });
    sharedResolution = resolution;
    notify();
    addTransaction({ type: "nostr_event_published", status: "success", description: `NIP-85 assertion: ${resolution} — permanent on relays` });
    addFlowStep({ fromWallet: "arbitrator", toWallet: "relay", label: `kind 30382 → ${resolution}`, direction: "right", status: "success" });
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="arbitrator" label="Carol (Arbitrator)" emoji="⚖️" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Scale className="h-4 w-4" /> Verify + Resolve</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!sharedDispute ? (
            <p className="text-sm text-muted-foreground text-center py-4">No dispute raised yet. Buyer raises dispute first.</p>
          ) : (
            <>
              <div className="rounded border bg-muted/40 p-2 text-xs space-y-1">
                <p className="font-medium">Dispute received</p>
                <p className="text-muted-foreground">Hash: <span className="font-mono">{sharedDispute.paymentHash.slice(0, 20)}...</span></p>
                <p className="text-muted-foreground">{sharedDispute.reason.slice(0, 80)}...</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Preimage (from merchant/Lightning)</label>
                <Input value={preimage} onChange={e => setPreimage(e.target.value)} placeholder="64-char hex preimage..." className="font-mono text-xs" />
              </div>
              <Button className="w-full" variant="outline" onClick={handleVerify} disabled={isVerifying || !preimage}>
                {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : <><Shield className="mr-2 h-4 w-4" />Verify Payment Hash</>}
              </Button>
              {verifyResult !== null && (
                <div className={`rounded border p-2 text-xs ${verifyResult ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  {verifyResult ? "✓ Payment verified — SHA-256(preimage) matches hash" : "✗ Preimage doesn't match — payment not proven"}
                </div>
              )}
              {!sharedResolution && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Publish NIP-85 resolution:</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(["buyer_wins", "seller_wins", "split"] as const).map(r => (
                      <Button key={r} size="sm" variant="outline" className="text-xs" onClick={() => handleResolve(r)}>
                        {r.replace("_", " ")}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {sharedResolution && (
                <div className="rounded border border-green-500/20 bg-green-500/5 p-2 text-xs">
                  <Badge variant="outline" className="text-green-600 mb-1">Resolved: {sharedResolution}</Badge>
                  <p className="text-muted-foreground">kind 30382 assertion published permanently to relays.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
