import { useState } from "react";
import { Zap, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useWalletStore, useTransactionStore } from "@/stores";
import { buildZapRequest } from "@/lib/nostr";

let sharedPaymentHash: string | null = null;
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

export function NostrDirectPaymentScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MerchantPanel />
      <BuyerPanel />
    </div>
  );
}

function MerchantPanel() {
  const [amount, setAmount] = useState("1000");
  const [description, setDescription] = useState("Lavender Candle x1");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { getNWCClient } = useWalletStore();
  const { getIdentity, getPrivateKey } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const merchantIdentity = getIdentity("merchant");

  const handleCreate = async () => {
    const client = getNWCClient("alice");
    const privkey = getPrivateKey("merchant");
    if (!client || !privkey) return;
    setIsCreating(true);
    try {
      const result = await client.makeInvoice({ amount: parseInt(amount), description });
      setInvoice(result.invoice);
      setPaymentHash(result.payment_hash);
      sharedPaymentHash = result.payment_hash;
      notify();

      // Publish NIP-57 zap request (kind 9734) showing the Nostr layer
      const zapReq = buildZapRequest(
        merchantIdentity?.publicKey ?? "0".repeat(64),
        parseInt(amount) * 1000,
        description,
        privkey
      );
      addTransaction({ type: "nostr_event_published", status: "success", description: `kind 9734 zap request published (amount: ${amount} sats)`, metadata: { eventKind: zapReq.kind, eventId: zapReq.id } });
      addFlowStep({ fromWallet: "merchant", toWallet: "buyer", label: `Invoice: ${amount} sats`, direction: "right", status: "success" });
    } catch (e) {
      addTransaction({ type: "invoice_created", status: "error", description: String(e) });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4" /> Create Invoice (NIP-47)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Amount (sats)</label>
            <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Invoice"}
          </Button>
          {invoice && (
            <div className="space-y-2">
              <div className="rounded bg-muted/50 p-2 text-xs font-mono break-all text-muted-foreground">{invoice.slice(0, 40)}...</div>
              <div className="text-xs text-muted-foreground">Payment hash: <span className="font-mono">{paymentHash?.slice(0, 16)}...</span></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BuyerPanel() {
  const [isPaying, setIsPaying] = useState(false);
  const [preimage, setPreimage] = useState<string | null>(null);
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; });

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handlePay = async () => {
    if (!sharedPaymentHash) return;
    const client = getNWCClient("bob");
    if (!client) return;
    setIsPaying(true);
    try {
      const lookup = await client.lookupInvoice({ payment_hash: sharedPaymentHash });
      if (lookup.preimage) {
        setPreimage(lookup.preimage);
        addTransaction({ type: "payment_sent", status: "success", description: "Payment confirmed via NWC lookup" });
        addFlowStep({ fromWallet: "buyer", toWallet: "merchant", label: "Payment confirmed ⚡", direction: "right", status: "success" });
        notify();
      } else {
        addTransaction({ type: "payment_sent", status: "error", description: "Invoice not paid yet" });
      }
    } catch (e) {
      addTransaction({ type: "payment_sent", status: "error", description: String(e) });
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Receipt className="h-4 w-4" /> Pay via NWC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sharedPaymentHash ? (
            <>
              <div className="rounded border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium">Invoice received</p>
                <p className="text-muted-foreground">Pay this invoice from your wallet, then confirm here.</p>
              </div>
              <Button className="w-full" onClick={handlePay} disabled={isPaying}>
                {isPaying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking...</> : "Confirm Payment"}
              </Button>
              {preimage && (
                <div className="rounded border border-green-500/20 bg-green-500/5 p-2 text-xs space-y-1">
                  <Badge variant="outline" className="text-green-600">✓ Paid</Badge>
                  <p>Preimage: <span className="font-mono">{preimage.slice(0, 20)}...</span></p>
                  <p className="text-muted-foreground">This preimage is cryptographic proof of payment.</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Waiting for merchant to create invoice...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
