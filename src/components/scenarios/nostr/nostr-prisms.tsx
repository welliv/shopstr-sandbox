import { useState } from "react";
import { GitBranch, Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BalanceBadge } from "@/components/nostr/verification-badges";
import { refreshBalance } from "@/lib/verification";
import { useWalletStore, useTransactionStore } from "@/stores";
import { LightningAddress } from "@getalby/lightning-tools";

export function NostrPrismsScenario() {
  const [sellerAddress, setSellerAddress] = useState("alice@getalby.com");
  const [platformAddress, setPlatformAddress] = useState("bob@getalby.com");
  const [sellerPct, setSellerPct] = useState(97);
  const [totalSats, setTotalSats] = useState(10000);
  const [isPaying, setIsPaying] = useState(false);
  const [results, setResults] = useState<{ address: string; sats: number; status: "success" | "error" }[]>([]);

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const platformPct = 100 - sellerPct;
  const sellerSats = Math.floor(totalSats * sellerPct / 100);
  const platformSats = totalSats - sellerSats;

  const handlePay = async () => {
    const client = getNWCClient("charlie");
    if (!client) return;
    setIsPaying(true);
    const newResults: typeof results = [];

    for (const { address, sats, label } of [
      { address: sellerAddress, sats: sellerSats, label: "seller" },
      { address: platformAddress, sats: platformSats, label: "platform" },
    ]) {
      try {
        const ln = new LightningAddress(address);
        await ln.fetch();
        const invoice = await ln.requestInvoice({ satoshi: sats });
        await client.payInvoice({ invoice: invoice.paymentRequest });
        newResults.push({ address, sats, status: "success" });
        addTransaction({ type: "payment_sent", status: "success", description: `${label}: ${sats} sats → ${address}` });
        addFlowStep({ fromWallet: "charlie", toWallet: label, label: `${sats} sats (${label === "seller" ? sellerPct : platformPct}%)`, direction: "right", status: "success" });
        // Refresh balances after each split leg payment
        refreshBalance('charlie');
        refreshBalance('alice');
      } catch (e) {
        newResults.push({ address, sats, status: "error" });
        addTransaction({ type: "payment_sent", status: "error", description: `${label} payment failed: ${String(e)}` });
      }
    }
    setResults(newResults);
    setIsPaying(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4" /> Configure Prism Split</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <BalanceBadge walletId="charlie" label="Charlie (Payer)" />
            <BalanceBadge walletId="alice" label="Alice (Seller)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Seller address</label>
              <Input value={sellerAddress} onChange={e => setSellerAddress(e.target.value)} placeholder="seller@getalby.com" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Platform address</label>
              <Input value={platformAddress} onChange={e => setPlatformAddress(e.target.value)} placeholder="platform@getalby.com" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Seller percentage: {sellerPct}% (platform: {platformPct}%)</label>
            <Input type="range" min={50} max={99} value={sellerPct} onChange={e => setSellerPct(parseInt(e.target.value))} className="h-2" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Total amount (sats)</label>
            <Input type="number" value={totalSats} onChange={e => setTotalSats(parseInt(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4" /> Payment Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {[
              { label: "Seller", sats: sellerSats, pct: sellerPct, color: "bg-green-500" },
              { label: "Platform", sats: platformSats, pct: platformPct, color: "bg-blue-500" },
            ].map(({ label, sats, pct, color }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-medium">{sats.toLocaleString()} sats ({pct}%)</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
            Splits are sequential Lightning payments — not atomic. Each recipient gets an independent invoice.
          </div>
          <Button className="w-full" onClick={handlePay} disabled={isPaying}>
            {isPaying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Paying split...</> : `Pay ${totalSats.toLocaleString()} sats in prism`}
          </Button>
          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className={`flex justify-between rounded p-2 text-xs ${r.status === "success" ? "bg-green-500/5 border border-green-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
                  <span className="font-mono">{r.address}</span>
                  <Badge variant="outline" className={r.status === "success" ? "text-green-600" : "text-red-600"}>{r.status === "success" ? `✓ ${r.sats} sats` : "✗ failed"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
