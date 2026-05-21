import { useState } from "react";
import { DollarSign, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletStore, useTransactionStore } from "@/stores";
import { LightningAddress } from "@getalby/lightning-tools";

export function NostrPlatformFeesScenario() {
  const [merchantAddress, setMerchantAddress] = useState("alice@getalby.com");
  const [platformAddress, setPlatformAddress] = useState("shopstr@getalby.com");
  const [orderSats, setOrderSats] = useState(10000);
  const [feePercent, setFeePercent] = useState(3);
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const feeSats = Math.floor(orderSats * feePercent / 100);
  const merchantSats = orderSats;
  const totalSats = orderSats + feeSats;

  const handlePay = async () => {
    const client = getNWCClient("bob");
    if (!client) return;
    setIsPaying(true);
    try {
      // Pay merchant first
      const merchantLn = new LightningAddress(merchantAddress);
      await merchantLn.fetch();
      const merchantInvoice = await merchantLn.requestInvoice({ satoshi: merchantSats });
      await client.payInvoice({ invoice: merchantInvoice.paymentRequest });
      addTransaction({ type: "payment_sent", status: "success", description: `Merchant: ${merchantSats.toLocaleString()} sats → ${merchantAddress}` });
      addFlowStep({ fromWallet: "buyer", toWallet: "merchant", label: `${merchantSats.toLocaleString()} sats (order)`, direction: "right", status: "success" });

      // Pay platform fee
      const platformLn = new LightningAddress(platformAddress);
      await platformLn.fetch();
      const platformInvoice = await platformLn.requestInvoice({ satoshi: feeSats });
      await client.payInvoice({ invoice: platformInvoice.paymentRequest });
      addTransaction({ type: "payment_sent", status: "success", description: `Platform fee: ${feeSats} sats (${feePercent}%) → ${platformAddress}` });
      addFlowStep({ fromWallet: "buyer", toWallet: "platform", label: `${feeSats} sats (${feePercent}% fee)`, direction: "right", status: "success" });

      setPaid(true);
    } catch (e) {
      addTransaction({ type: "payment_sent", status: "error", description: String(e) });
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4" /> Configure Fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Merchant address</label>
            <Input value={merchantAddress} onChange={e => setMerchantAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Platform address</label>
            <Input value={platformAddress} onChange={e => setPlatformAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Order amount (sats)</label>
            <Input type="number" value={orderSats} onChange={e => setOrderSats(parseInt(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Platform fee: {feePercent}%</label>
            <Input type="range" min={1} max={15} value={feePercent} onChange={e => setFeePercent(parseInt(e.target.value))} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Receipt className="h-4 w-4" /> Invoice Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {[
              { label: "Order total", sats: merchantSats, note: "goes to merchant" },
              { label: `Platform fee (${feePercent}%)`, sats: feeSats, note: "visible before you pay" },
              { label: "You pay", sats: totalSats, note: "total", bold: true },
            ].map(({ label, sats, note, bold }) => (
              <div key={label} className={`flex justify-between text-sm ${bold ? "border-t pt-2 font-medium" : ""}`}>
                <span>{label} <span className="text-xs text-muted-foreground">({note})</span></span>
                <span>{sats.toLocaleString()} sats</span>
              </div>
            ))}
          </div>
          <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            Fee is shown transparently before payment. Compare to eBay's 13% hidden from the buyer.
          </div>
          {paid ? (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-3 text-xs space-y-1">
              <Badge variant="outline" className="text-green-600">✓ Paid</Badge>
              <p>Merchant received {merchantSats.toLocaleString()} sats · Platform received {feeSats} sats</p>
            </div>
          ) : (
            <Button className="w-full" onClick={handlePay} disabled={isPaying}>
              {isPaying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Paying...</> : `Pay ${totalSats.toLocaleString()} sats`}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
