import { useState } from "react";
import { Megaphone, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletStore, useTransactionStore } from "@/stores";
import { LightningAddress } from "@getalby/lightning-tools";

// Simulated audience — real impl uses NIP-50 search across relays
const MOCK_AUDIENCE = [
  { npub: "npub1abc...", name: "Candle Lover", lud16: "viewer1@getalby.com" },
  { npub: "npub1def...", name: "Handmade Fan", lud16: "viewer2@getalby.com" },
  { npub: "npub1ghi...", name: "Artisan Shopper", lud16: "" }, // no wallet
];

interface ViewerResult { name: string; status: "zapped" | "no_lnurl" | "error"; amount?: number; }

export function NostrZapvertisingScenario() {
  const [query, setQuery] = useState("handmade candles");
  const [message, setMessage] = useState("Try Alice's Candles — handmade soy wax, ships in 48h! Use code NOSTR10 for 10% off.");
  const [amountSats, setAmountSats] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ViewerResult[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handleRun = async () => {
    const client = getNWCClient("alice");
    if (!client) return;
    setIsRunning(true);
    setResults([]);
    let spent = 0;
    const newResults: ViewerResult[] = [];

    for (const viewer of MOCK_AUDIENCE) {
      if (!viewer.lud16) {
        newResults.push({ name: viewer.name, status: "no_lnurl" });
        addTransaction({ type: "nostr_zap_sent", status: "error", description: `${viewer.name}: no LNURL wallet — skipped` });
        continue;
      }
      try {
        const ln = new LightningAddress(viewer.lud16);
        await ln.fetch();
        const invoice = await ln.requestInvoice({ satoshi: amountSats, comment: message });
        await client.payInvoice({ invoice: invoice.paymentRequest });
        spent += amountSats;
        newResults.push({ name: viewer.name, status: "zapped", amount: amountSats });
        addTransaction({ type: "nostr_zap_sent", status: "success", description: `${viewer.name}: ${amountSats} sats paid to see ad` });
        addFlowStep({ fromWallet: "advertiser", toWallet: viewer.name.toLowerCase().replace(" ", ""), label: `${amountSats} sats ad payment`, direction: "right", status: "success" });
      } catch (e) {
        newResults.push({ name: viewer.name, status: "error" });
        addTransaction({ type: "nostr_zap_sent", status: "error", description: `${viewer.name}: ${String(e)}` });
      }
      setResults([...newResults]);
    }
    setTotalSpent(spent);
    setIsRunning(false);
  };

  const reached = results.filter(r => r.status === "zapped").length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Megaphone className="h-4 w-4" /> Campaign Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Audience search query (NIP-50)</label>
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="handmade candles" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ad message</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Amount per viewer (sats)</label>
            <div className="flex gap-1">
              {[50, 100, 500].map(n => (
                <button key={n} onClick={() => setAmountSats(n)} className={`flex-1 py-1 text-xs rounded border ${amountSats === n ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            Search finds {MOCK_AUDIENCE.length} Nostr users interested in "{query}". Only users with LNURL wallets can receive sats.
          </div>
          <Button className="w-full" onClick={handleRun} disabled={isRunning}>
            {isRunning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running campaign...</> : "Run Campaign"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> Campaign Results</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 && !isRunning ? (
            <p className="text-sm text-muted-foreground text-center py-8">Run a campaign to see results here.</p>
          ) : (
            <div className="space-y-3">
              {(reached > 0 || totalSpent > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-muted/40 p-2 text-center text-xs"><p className="text-xl font-bold">{reached}</p><p className="text-muted-foreground">viewers reached</p></div>
                  <div className="rounded bg-muted/40 p-2 text-center text-xs"><p className="text-xl font-bold">{totalSpent.toLocaleString()}</p><p className="text-muted-foreground">sats spent</p></div>
                </div>
              )}
              <div className="space-y-1">
                {results.map((r, i) => (
                  <div key={i} className="flex justify-between items-center rounded border px-3 py-2 text-xs">
                    <span>{r.name}</span>
                    <Badge variant="outline" className={
                      r.status === "zapped" ? "text-green-600" :
                      r.status === "no_lnurl" ? "text-yellow-600" : "text-red-600"
                    }>
                      {r.status === "zapped" ? `✓ ${r.amount} sats` :
                       r.status === "no_lnurl" ? "no wallet" : "✗ failed"}
                    </Badge>
                  </div>
                ))}
              </div>
              {!isRunning && results.length > 0 && (
                <p className="text-xs text-muted-foreground">Traditional ads: platform gets paid, users get nothing. Zapvertising: users receive real sats for their attention.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
