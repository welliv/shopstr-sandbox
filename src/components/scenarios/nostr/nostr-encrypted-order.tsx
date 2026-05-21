import { useState } from "react";
import { Lock, Unlock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";
import { giftWrap, unwrapGiftWrap } from "@/lib/nostr";

interface OrderData { items: string; address: string; message: string; }
let sharedWrap: ReturnType<typeof giftWrap> | null = null;
const listeners = new Set<() => void>();
function setWrap(w: typeof sharedWrap) { sharedWrap = w; listeners.forEach(l => l()); }

export function NostrEncryptedOrderScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BuyerPanel />
      <MerchantPanel />
    </div>
  );
}

function BuyerPanel() {
  const [items, setItems] = useState("2x Lavender Candle (8oz)");
  const [address, setAddress] = useState("123 Main St, Portland OR 97201");
  const [message, setMessage] = useState("Please include gift wrapping!");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const { getPrivateKey, getIdentity } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const buyerIdentity = getIdentity("buyer");
  const merchantIdentity = getIdentity("merchant");

  const handleSend = async () => {
    const buyerKey = getPrivateKey("buyer");
    if (!buyerKey || !merchantIdentity) return;
    setIsSending(true);

    const orderContent = JSON.stringify({ type: 0, items, address, message });
    const wrap = giftWrap(orderContent, buyerKey, merchantIdentity.publicKey);
    setWrap(wrap);

    addFlowStep({ fromWallet: "buyer", toWallet: "merchant", label: "kind 1059 (gift wrap)", direction: "right", status: "success" });
    addTransaction({ type: "nostr_order_sent", status: "success", description: `Encrypted order sent — relay sees only ephemeral pubkey` });
    setSent(true);
    setIsSending(false);
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4" /> Compose Order (NIP-59)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Items</label>
            <Input value={items} onChange={(e) => setItems(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Shipping Address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Message to merchant</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
          </div>
          {!getIdentity("merchant") && (
            <p className="text-xs text-yellow-600">⚠️ Generate merchant identity first (Scenario 1)</p>
          )}
          <Button className="w-full" onClick={handleSend} disabled={!buyerIdentity || !merchantIdentity || isSending}>
            {isSending ? "Encrypting + Sending..." : "Send Encrypted Order"}
          </Button>
          {sent && (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-2 text-xs space-y-1">
              <p className="font-medium text-green-700">Order sent — 3 layers of encryption applied:</p>
              <p>1. Rumor (content) → 2. Sealed with buyer key → 3. Wrapped with ephemeral key</p>
              <p className="text-muted-foreground">Relay sees only: kind 1059 from random pubkey, for merchant pubkey</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MerchantPanel() {
  const [decrypted, setDecrypted] = useState<OrderData | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => listeners.delete(l); });

  const { getPrivateKey, getIdentity } = useNostrStore();
  const { addTransaction } = useTransactionStore();
  const merchantIdentity = getIdentity("merchant");

  const handleDecrypt = () => {
    const merchantKey = getPrivateKey("merchant");
    if (!merchantKey || !sharedWrap) return;
    setIsDecrypting(true);
    try {
      const { content } = unwrapGiftWrap(sharedWrap, merchantKey);
      const order = JSON.parse(content) as OrderData;
      setDecrypted(order);
      addTransaction({ type: "nostr_order_received", status: "success", description: `Decrypted order: ${order.items}` });
    } catch (e: unknown) {
      addTransaction({ type: "nostr_order_received", status: "error", description: "Decryption failed: " + String(e) });
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Unlock className="h-4 w-4" /> Decrypt Order
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sharedWrap ? (
            <>
              <div className="rounded bg-muted/50 p-2 text-xs space-y-1">
                <p className="font-medium">Received gift wrap (kind 1059)</p>
                <p className="font-mono text-muted-foreground">from: {sharedWrap.pubkey.slice(0, 16)}... (ephemeral)</p>
                <p className="text-muted-foreground">Content: [NIP-44 encrypted blob]</p>
              </div>
              <Button className="w-full" onClick={handleDecrypt} disabled={!merchantIdentity || isDecrypting}>
                {isDecrypting ? "Decrypting..." : "Decrypt Order"}
              </Button>
              {decrypted && (
                <div className="rounded border border-green-500/20 bg-green-500/5 p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2 font-medium text-green-700">
                    <Package className="h-4 w-4" /> Order decrypted successfully
                  </div>
                  <div className="space-y-1 text-xs">
                    <p><strong>Items:</strong> {decrypted.items}</p>
                    <p><strong>Address:</strong> {decrypted.address}</p>
                    <p><strong>Message:</strong> {decrypted.message}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Waiting for buyer to send an encrypted order...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
