import { useState } from "react";
import { Star, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {} from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useWalletStore, useTransactionStore } from "@/stores";
import { verifyPreimage } from "@/lib/nostr";
import { BalanceBadge, EventVerifyLink } from "@/components/nostr/verification-badges";
import { refreshBalance, verifyEventOnRelay } from "@/lib/verification";

export function NostrReviewsScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BuyerPanel />
      <ReviewFeedPanel />
    </div>
  );
}

interface Review { rating: number; content: string; preimage: string; buyerNpub: string; verified: boolean; eventId: string; }
let reviews: Review[] = [];
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

function BuyerPanel() {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("Burns beautifully! Already ordered again.");
  const [preimage, setPreimage] = useState("");
  const [_paymentHash, setPaymentHash] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const { getPrivateKey, getIdentity, publishNostrEvent } = useNostrStore();
  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const buyerIdentity = getIdentity("buyer");

  const handlePayAndReview = async () => {
    const client = getNWCClient("bob");
    const merchantClient = getNWCClient("alice");
    if (!client || !merchantClient) return;
    setIsPublishing(true);
    try {
      const invoiceResult = await merchantClient.makeInvoice({ amount: 1000, description: "Purchase for review" });
      const payResult = await client.payInvoice({ invoice: invoiceResult.invoice });
      const pimage = payResult.preimage;
      if (!pimage) throw new Error("No preimage returned");
      setPreimage(pimage);
      setPaymentHash(invoiceResult.payment_hash);

      const valid = await verifyPreimage(pimage, invoiceResult.payment_hash);
      const privkey = getPrivateKey("buyer");
      if (!privkey || !valid) throw new Error("Preimage verification failed");

      await refreshBalance('alice');
      await refreshBalance('bob');

      const result = await publishNostrEvent("buyer", {
        kind: 31990,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["preimage", pimage],
          ["rating", String(rating)],
          ["L", "review"],
        ],
        content,
      });

      const revEventId = result.event.id;
      const verified = await verifyEventOnRelay(revEventId, buyerIdentity?.publicKey ?? "", 31990, 4000);

      reviews = [{ rating, content, preimage: pimage, buyerNpub: buyerIdentity?.npub ?? "", verified: true, eventId: revEventId }, ...reviews];
      notify();
      addTransaction({ type: "nostr_review_published", status: "success", description: `Review published with preimage gate (${rating}★) — relay ${verified ? "confirmed" : "verification pending"}` });
      addFlowStep({ fromWallet: "buyer", toWallet: "merchant", label: "kind 31990 + preimage", direction: "right", status: "success" });
    } catch (e) {
      addTransaction({ type: "nostr_review_published", status: "error", description: String(e) });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <div className="flex gap-2 items-center mb-2">
        <BalanceBadge walletId="alice" label="Alice (Merchant)" />
        <BalanceBadge walletId="bob" label="Bob (Buyer)" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Star className="h-4 w-4" /> Write Verified Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(n)} className={`text-xl ${n <= rating ? "text-yellow-400" : "text-muted"}`}>★</button>
            ))}
          </div>
          <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="Your review..." />
          <div className="rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
            Clicking "Pay + Review" will pay 1,000 sats to get a preimage, then publish the review with cryptographic proof of purchase.
          </div>
          <Button className="w-full" onClick={handlePayAndReview} disabled={isPublishing || !buyerIdentity}>
            {isPublishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Paying + Publishing...</> : "Pay 1,000 sats + Publish Review"}
          </Button>
          {preimage && (
            <div className="text-xs space-y-1">
              <p className="text-muted-foreground">Preimage (proof of purchase):</p>
              <p className="font-mono text-[10px] bg-green-500/5 rounded p-1 break-all">{preimage}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewFeedPanel() {
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Verified Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No reviews yet. Pay and publish a review on the left.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r, i) => (
              <div key={i} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-yellow-400">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                  {r.verified && <Badge variant="outline" className="text-green-600 text-xs">✓ Preimage verified</Badge>}
                </div>
                <p className="text-sm">{r.content}</p>
                <p className="text-xs text-muted-foreground font-mono">{r.buyerNpub.slice(0, 20)}...</p>
                {r.eventId && <EventVerifyLink eventId={r.eventId} label="verify on njump.me" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
