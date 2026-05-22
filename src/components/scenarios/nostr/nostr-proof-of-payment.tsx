import { useState } from "react";
import { ShieldCheck, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletStore, useTransactionStore } from "@/stores";
import { verifyPreimage } from "@/lib/nostr";
import { BalanceBadge } from "@/components/nostr/verification-badges";
import { refreshBalance } from "@/lib/verification";

export function NostrProofOfPaymentScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CreateInvoicePanel />
      <VerifyPanel />
    </div>
  );
}

function CreateInvoicePanel() {
  const [amount, setAmount] = useState("1000");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [preimage, setPreimage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handleCreate = async () => {
    const client = getNWCClient("alice");
    if (!client) return;
    setIsCreating(true);
    try {
      const result = await client.makeInvoice({ amount: parseInt(amount), description: "Proof of payment demo" });
      setInvoice(result.invoice);
      setPaymentHash(result.payment_hash);
      addTransaction({ type: "invoice_created", status: "success", description: `Invoice: ${amount} sats — payment_hash generated` });
    } catch (e) {
      addTransaction({ type: "invoice_created", status: "error", description: String(e) });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePay = async () => {
    if (!invoice || !paymentHash) return;
    const client = getNWCClient("bob");
    if (!client) return;
    setIsPaying(true);
    try {
      const result = await client.payInvoice({ invoice });
      const pimage = result.preimage;
      setPreimage(pimage);
      await refreshBalance("alice");
      await refreshBalance("bob");
      addFlowStep({ fromWallet: "bob", toWallet: "alice", label: "Payment + preimage returned", direction: "right", status: "success" });
      addTransaction({ type: "payment_sent", status: "success", description: `Paid — preimage: ${pimage?.slice(0, 16)}...` });
    } catch (e) {
      addTransaction({ type: "payment_sent", status: "error", description: String(e) });
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 justify-between">
          <CardTitle className="flex items-center gap-2 text-sm"><Hash className="h-4 w-4" /> Create + Pay Invoice</CardTitle>
          <div className="flex gap-2">
            <BalanceBadge walletId="alice" label="Alice" />
            <BalanceBadge walletId="bob" label="Bob" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Amount (sats)</label>
          <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" />
        </div>
        <Button className="w-full" onClick={handleCreate} disabled={isCreating || !!invoice}>
          {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : invoice ? "Invoice Created ✓" : "Create Invoice (Alice)"}
        </Button>
        {invoice && (
          <Button className="w-full" variant="outline" onClick={handlePay} disabled={isPaying || !!preimage}>
            {isPaying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Paying...</> : preimage ? "Paid ✓" : "Pay Invoice (Bob)"}
          </Button>
        )}
        {paymentHash && (
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">payment_hash:</p>
            <p className="font-mono bg-muted/50 rounded p-1 break-all text-[10px]">{paymentHash}</p>
          </div>
        )}
        {preimage && (
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">preimage (proof):</p>
            <p className="font-mono bg-green-500/5 border border-green-500/20 rounded p-1 break-all text-[10px]">{preimage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VerifyPanel() {
  const [preimageInput, setPreimageInput] = useState("");
  const [hashInput, setHashInput] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { addTransaction } = useTransactionStore();

  const handleVerify = async () => {
    setIsVerifying(true);
    const valid = await verifyPreimage(preimageInput, hashInput);
    setResult(valid);
    addTransaction({
      type: "nostr_event_published", status: valid ? "success" : "error",
      description: valid ? "SHA-256(preimage) === paymentHash ✓ — proof valid" : "Preimage does not match hash — invalid proof"
    });
    setIsVerifying(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Verify Proof</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
          SHA-256(preimage) must equal paymentHash. Copy values from the left panel.
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Preimage (hex)</label>
          <Input value={preimageInput} onChange={e => setPreimageInput(e.target.value)} placeholder="64-char hex..." className="font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Payment Hash (hex)</label>
          <Input value={hashInput} onChange={e => setHashInput(e.target.value)} placeholder="64-char hex..." className="font-mono text-xs" />
        </div>
        <Button className="w-full" onClick={handleVerify} disabled={!preimageInput || !hashInput || isVerifying}>
          {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Verify SHA-256"}
        </Button>
        {result !== null && (
          <div className={`rounded border p-3 text-sm ${result ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
            <Badge variant="outline" className={result ? "text-green-600" : "text-red-600"}>
              {result ? "✓ Valid Proof" : "✗ Invalid"}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {result ? "This preimage cryptographically proves the payment settled." : "SHA-256(preimage) does not match the payment hash."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
