import { useState } from "react";
import { ShoppingCart, Trash2, Loader2, Plus } from "lucide-react";
import { BalanceBadge } from "@/components/nostr/verification-badges";
import { refreshBalance } from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletStore, useTransactionStore } from "@/stores";
import { LightningAddress } from "@getalby/lightning-tools";

interface CartItem { title: string; merchantAddress: string; sats: number; }
type PayStatus = "idle" | "paying" | "done" | "error";
interface PayResult { item: CartItem; status: "success" | "error"; }

const DEFAULT_ITEMS: CartItem[] = [
  { title: "Lavender Candle (2x)", merchantAddress: "alice@getalby.com", sats: 5000 },
  { title: "Cedar Soap", merchantAddress: "bob@getalby.com", sats: 2000 },
];

export function NostrCartScenario() {
  const [items, setItems] = useState<CartItem[]>(DEFAULT_ITEMS);
  const [newTitle, setNewTitle] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newSats, setNewSats] = useState("1000");
  const [payStatus, setPayStatus] = useState<PayStatus>("idle");
  const [results, setResults] = useState<PayResult[]>([]);

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const totalSats = items.reduce((s, i) => s + i.sats, 0);
  const merchants = [...new Set(items.map(i => i.merchantAddress))].length;

  const handleAddItem = () => {
    if (!newTitle || !newAddress || !newSats) return;
    setItems(prev => [...prev, { title: newTitle, merchantAddress: newAddress, sats: parseInt(newSats) }]);
    setNewTitle(""); setNewAddress(""); setNewSats("1000");
  };

  const handleCheckout = async () => {
    const client = getNWCClient("charlie");
    if (!client) return;
    setPayStatus("paying");
    const newResults: PayResult[] = [];

    for (const item of items) {
      try {
        const ln = new LightningAddress(item.merchantAddress);
        await ln.fetch();
        const invoice = await ln.requestInvoice({ satoshi: item.sats });
        await client.payInvoice({ invoice: invoice.paymentRequest });
        newResults.push({ item, status: "success" });
        addTransaction({ type: "payment_sent", status: "success", description: `${item.title}: ${item.sats} sats → ${item.merchantAddress}` });
        addFlowStep({ fromWallet: "buyer", toWallet: item.merchantAddress.split("@")[0], label: `${item.sats} sats`, direction: "right", status: "success" });
      } catch (e) {
        newResults.push({ item, status: "error" });
        addTransaction({ type: "payment_sent", status: "error", description: `${item.title}: ${String(e)}` });
      }
    }
    setResults(newResults);
    setPayStatus("done");
    refreshBalance("charlie");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><ShoppingCart className="h-4 w-4" /> Cart ({items.length} items)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded border p-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{item.merchantAddress}</p>
                </div>
                <span className="text-xs font-medium shrink-0">{item.sats.toLocaleString()} sats</span>
                <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-medium">
              <span>{merchants} merchant{merchants !== 1 ? "s" : ""}</span>
              <span>{totalSats.toLocaleString()} sats total</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Add Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Product name" />
            <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="merchant@getalby.com" />
            <Input type="number" value={newSats} onChange={e => setNewSats(e.target.value)} placeholder="Sats" />
            <Button className="w-full" variant="outline" onClick={handleAddItem} disabled={!newTitle || !newAddress}>Add to Cart</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">How it works:</p>
            <p>One checkout, {merchants} merchants. Sequential Lightning payments — each merchant receives their amount independently.</p>
          </div>
          {payStatus === "idle" && (
            <Button className="w-full" onClick={handleCheckout} disabled={items.length === 0}>
              Pay {totalSats.toLocaleString()} sats to {merchants} merchant{merchants !== 1 ? "s" : ""}
            </Button>
          )}
          {payStatus === "paying" && (
            <div className="flex items-center gap-2 justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Paying {merchants} merchants sequentially...
            </div>
          )}
          {(payStatus === "done" || payStatus === "error") && results.length > 0 && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`rounded border p-2 text-xs ${r.status === "success" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{r.item.title}</span>
                    <Badge variant="outline" className={r.status === "success" ? "text-green-600" : "text-red-600"}>
                      {r.status === "success" ? `✓ ${r.item.sats} sats` : "✗ failed"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground font-mono">{r.item.merchantAddress}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <BalanceBadge walletId="charlie" label="Charlie" />
              </div>
              <Button className="w-full" variant="outline" onClick={() => { setResults([]); setPayStatus("idle"); setItems(DEFAULT_ITEMS); }}>
                Reset Cart
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
