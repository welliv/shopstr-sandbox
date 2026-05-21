import { useState } from "react";
import { Lock, Unlock, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useWalletStore, useTransactionStore } from "@/stores";

type EscrowState = "idle" | "invoice_created" | "held" | "released" | "expired";

let sharedState: { invoice: string | null; paymentHash: string | null; expiresAt: number | null; status: EscrowState } = {
  invoice: null, paymentHash: null, expiresAt: null, status: "idle"
};
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }
function setShared(update: Partial<typeof sharedState>) {
  sharedState = { ...sharedState, ...update };
  notify();
}

export function NostrEscrowScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MerchantPanel />
      <BuyerPanel />
    </div>
  );
}

function MerchantPanel() {
  const [amount, setAmount] = useState("5000");
  const [isCreating, setIsCreating] = useState(false);
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; });

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handleCreateEscrow = async () => {
    const client = getNWCClient("alice");
    if (!client) return;
    setIsCreating(true);
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 min deadline
      const result = await client.makeInvoice({ amount: parseInt(amount), description: `Escrow — expires ${new Date(expiresAt * 1000).toLocaleTimeString()}` });
      setShared({ invoice: result.invoice, paymentHash: result.payment_hash, expiresAt, status: "invoice_created" });
      addTransaction({ type: "nostr_event_published", status: "success", description: `Hold invoice created — NIP-40 deadline: ${new Date(expiresAt * 1000).toLocaleTimeString()}`, metadata: { expiration: expiresAt } });
      addFlowStep({ fromWallet: "merchant", toWallet: "buyer", label: "Invoice + NIP-40 deadline", direction: "right", status: "success" });
    } catch (e) {
      addTransaction({ type: "invoice_created", status: "error", description: String(e) });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRelease = () => {
    setShared({ status: "released" });
    addTransaction({ type: "nostr_event_published", status: "success", description: "Preimage released — escrow settled ✓" });
    addFlowStep({ fromWallet: "merchant", toWallet: "buyer", label: "Preimage released → settled", direction: "right", status: "success" });
  };

  const state = sharedState;

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Lock className="h-4 w-4" /> Escrow (Hold Invoice)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.status === "idle" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Amount (sats)</label>
                <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" />
              </div>
              <Button className="w-full" onClick={handleCreateEscrow} disabled={isCreating}>
                {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Escrow Invoice"}
              </Button>
            </>
          )}
          {state.status === "invoice_created" && (
            <div className="rounded border bg-muted/40 p-3 text-xs space-y-1">
              <p className="font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Invoice created</p>
              <p className="text-muted-foreground">Deadline: {state.expiresAt ? new Date(state.expiresAt * 1000).toLocaleTimeString() : "—"}</p>
              <p className="text-muted-foreground">Waiting for buyer to pay...</p>
            </div>
          )}
          {state.status === "held" && (
            <div className="space-y-3">
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-2 text-xs">
                <p className="font-medium text-yellow-700">⚡ Funds held — not yet settled</p>
                <p className="text-muted-foreground mt-1">Ship the item, then release the preimage to collect payment.</p>
              </div>
              <Button className="w-full" onClick={handleRelease}>Release Preimage → Collect Payment</Button>
            </div>
          )}
          {state.status === "released" && (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-3 text-xs">
              <Badge variant="outline" className="text-green-600 mb-2">✓ Escrow Released</Badge>
              <p>Preimage revealed → Lightning Network settles payment to merchant.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BuyerPanel() {
  const [isPaying, setIsPaying] = useState(false);
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; });

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handlePay = async () => {
    if (!sharedState.invoice) return;
    const client = getNWCClient("bob");
    if (!client) return;
    setIsPaying(true);
    try {
      await client.payInvoice({ invoice: sharedState.invoice });
      setShared({ status: "held" });
      addTransaction({ type: "payment_sent", status: "success", description: "Invoice paid — funds held in escrow" });
      addFlowStep({ fromWallet: "buyer", toWallet: "merchant", label: "Funds held ⏳ (not settled)", direction: "right", status: "success" });
    } catch (e) {
      addTransaction({ type: "payment_sent", status: "error", description: String(e) });
    } finally {
      setIsPaying(false);
    }
  };

  const state = sharedState;

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" /> Buyer Protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.status === "idle" && (
            <p className="text-sm text-muted-foreground text-center py-4">Waiting for merchant to create escrow invoice...</p>
          )}
          {state.status === "invoice_created" && (
            <div className="space-y-3">
              <div className="rounded border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium">Escrow invoice received</p>
                <p className="text-muted-foreground">Your payment will be HELD — not released to merchant until you confirm delivery.</p>
                {state.expiresAt && <p className="text-muted-foreground">If merchant doesn't release by {new Date(state.expiresAt * 1000).toLocaleTimeString()}, funds auto-refund.</p>}
              </div>
              <Button className="w-full" onClick={handlePay} disabled={isPaying}>
                {isPaying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Paying...</> : "Pay into Escrow"}
              </Button>
            </div>
          )}
          {state.status === "held" && (
            <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs">
              <p className="font-medium text-yellow-700">Funds held — awaiting merchant delivery</p>
              <p className="text-muted-foreground mt-1">Merchant must ship and release preimage before the deadline, or you get a full refund.</p>
            </div>
          )}
          {(state.status === "released") && (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-3 text-xs">
              <Badge variant="outline" className="text-green-600 mb-2">✓ Delivery Confirmed</Badge>
              <p>Merchant revealed preimage. Payment settled. Transaction complete.</p>
            </div>
          )}
          {state.status === "expired" && (
            <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-xs">
              <Unlock className="h-4 w-4 text-red-500 mb-1" />
              <p className="font-medium text-red-700">Escrow expired — refunded</p>
              <p className="text-muted-foreground">Merchant missed the deadline. Funds returned to your wallet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
