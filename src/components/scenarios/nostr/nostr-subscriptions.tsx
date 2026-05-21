import { useState, useEffect } from "react";
import { RefreshCw, Play, Square} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletStore, useTransactionStore } from "@/stores";
import { LightningAddress } from "@getalby/lightning-tools";

interface ChargeRecord { chargedAt: Date; amount: number; success: boolean; }

export function NostrSubscriptionsScenario() {
  const [merchantAddress, setMerchantAddress] = useState("alice@getalby.com");
  const [amountSats, setAmountSats] = useState(1000);
  const [intervalSec, setIntervalSec] = useState(30);
  const [isRunning, setIsRunning] = useState(false);
  const [charges, setCharges] = useState<ChargeRecord[]>([]);
  const [nextChargeIn, setNextChargeIn] = useState(0);

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const charge = async () => {
    const client = getNWCClient("bob");
    if (!client) return;
    try {
      const ln = new LightningAddress(merchantAddress);
      await ln.fetch();
      const invoice = await ln.requestInvoice({ satoshi: amountSats });
      await client.payInvoice({ invoice: invoice.paymentRequest });
      setCharges(prev => [{ chargedAt: new Date(), amount: amountSats, success: true }, ...prev]);
      addTransaction({ type: "payment_sent", status: "success", description: `Subscription charge: ${amountSats} sats → ${merchantAddress}` });
      addFlowStep({ fromWallet: "buyer", toWallet: "merchant", label: `Auto-charge: ${amountSats} sats`, direction: "right", status: "success" });
    } catch (e) {
      setCharges(prev => [{ chargedAt: new Date(), amount: amountSats, success: false }, ...prev]);
      addTransaction({ type: "payment_sent", status: "error", description: `Charge failed: ${String(e)}` });
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    let countdown = intervalSec;
    setNextChargeIn(countdown);
    const tick = setInterval(() => {
      countdown--;
      setNextChargeIn(countdown);
      if (countdown <= 0) {
        charge();
        countdown = intervalSec;
        setNextChargeIn(countdown);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [isRunning, intervalSec, merchantAddress, amountSats]);

  const totalPaid = charges.filter(c => c.success).reduce((s, c) => s + c.amount, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4" /> Subscription Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Merchant Lightning Address</label>
            <Input value={merchantAddress} onChange={e => setMerchantAddress(e.target.value)} placeholder="merchant@getalby.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Amount per charge (sats)</label>
            <Input type="number" value={amountSats} onChange={e => setAmountSats(parseInt(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Charge interval (seconds)</label>
            <div className="flex gap-1">
              {[10, 30, 60].map(n => (
                <button key={n} onClick={() => setIntervalSec(n)} className={`flex-1 py-1 text-xs rounded border ${intervalSec === n ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{n}s</button>
              ))}
            </div>
          </div>
          <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            NIP-47 NWC with a budget cap lets the merchant charge automatically within the buyer's pre-authorized limit.
          </div>
          {isRunning ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Next charge in</span>
                <Badge variant="outline">{nextChargeIn}s</Badge>
              </div>
              <Button className="w-full" variant="destructive" onClick={() => setIsRunning(false)}>
                <Square className="mr-2 h-4 w-4" />Stop Subscription
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={() => setIsRunning(true)}>
              <Play className="mr-2 h-4 w-4" />Start Subscription
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Charge History</CardTitle>
        </CardHeader>
        <CardContent>
          {charges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Start the subscription to see charges here.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded bg-muted/40 p-2 text-xs flex justify-between">
                <span>Total paid</span>
                <span className="font-bold">{totalPaid.toLocaleString()} sats</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {charges.map((c, i) => (
                  <div key={i} className={`flex justify-between items-center rounded px-2 py-1 text-xs ${c.success ? "bg-green-500/5" : "bg-red-500/5"}`}>
                    <span className="text-muted-foreground">{c.chargedAt.toLocaleTimeString()}</span>
                    <Badge variant="outline" className={c.success ? "text-green-600" : "text-red-600"}>
                      {c.success ? `✓ ${c.amount} sats` : "✗ failed"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
