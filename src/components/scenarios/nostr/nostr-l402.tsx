import { useState } from "react";
import { Code, Lock, Unlock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletStore, useTransactionStore } from "@/stores";

// Simulate an L402 API server for demo purposes
const MOCK_API_DATA = {
  products: [
    { id: "candle-001", title: "Lavender Candle", price: "18.00", currency: "USD", stock: 12 },
    { id: "candle-002", title: "Cedar Candle", price: "22.00", currency: "USD", stock: 5 },
    { id: "soap-001", title: "Cedar Soap", price: "8.00", currency: "USD", stock: 20 },
  ]
};

export function NostrL402Scenario() {
  const [apiUrl, setApiUrl] = useState("https://api.alicecandles.com/catalog");
  const [pricePerCall, setPricePerCall] = useState(1);
  const [state, setState] = useState<"idle" | "challenged" | "paying" | "paid">("idle");
  const [_invoice, setInvoice] = useState<string | null>(null);
  const [data, setData] = useState<typeof MOCK_API_DATA | null>(null);

  const { getNWCClient } = useWalletStore();
  const { addTransaction, addFlowStep } = useTransactionStore();

  const handleRequest = () => {
    // Simulate 402 response from API server
    const mockInvoice = `lnbc${pricePerCall}u1p3mock...`; // would be a real invoice
    setInvoice(mockInvoice);
    setState("challenged");
    addTransaction({ type: "nostr_event_published", status: "pending", description: `GET ${apiUrl} → 402 Payment Required (${pricePerCall} sat)` });
    addFlowStep({ fromWallet: "buyer", toWallet: "api", label: "GET /catalog →", direction: "right", status: "pending" });
    addFlowStep({ fromWallet: "api", toWallet: "buyer", label: "← 402 + invoice", direction: "left", status: "success" });
  };

  const handlePay = async () => {
    const client = getNWCClient("bob");
    if (!client) return;
    setState("paying");
    try {
      // In real L402: pay invoice, get preimage, retry with Authorization header
      // Here we simulate success after wallet confirms
      await new Promise(r => setTimeout(r, 1500)); // simulate payment round-trip
      setState("paid");
      setData(MOCK_API_DATA);
      addTransaction({ type: "payment_sent", status: "success", description: `L402 paid: ${pricePerCall} sat → preimage used as credential` });
      addFlowStep({ fromWallet: "buyer", toWallet: "api", label: "GET /catalog + Authorization: L402 macaroon:preimage", direction: "right", status: "success" });
      addFlowStep({ fromWallet: "api", toWallet: "buyer", label: "← 200 OK + catalog data", direction: "left", status: "success" });
    } catch (e) {
      addTransaction({ type: "payment_sent", status: "error", description: String(e) });
      setState("challenged");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Code className="h-4 w-4" /> API Client (Bob)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Paid API endpoint</label>
            <Input value={apiUrl} onChange={e => setApiUrl(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Price per call (sats)</label>
            <Input type="number" value={pricePerCall} onChange={e => setPricePerCall(parseInt(e.target.value))} />
          </div>
          <div className="rounded bg-muted/40 p-2 text-xs font-mono text-muted-foreground space-y-1">
            <p>GET {apiUrl}</p>
            {state === "challenged" && <p className="text-yellow-600">← HTTP 402 + invoice</p>}
            {state === "paid" && <><p className="text-green-600">Authorization: L402 mac:preimage</p><p className="text-green-600">← 200 OK + data</p></>}
          </div>
          {state === "idle" && (
            <Button className="w-full" onClick={handleRequest}>Request Catalog API</Button>
          )}
          {state === "challenged" && (
            <div className="space-y-2">
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-2 text-xs">
                <Lock className="h-3 w-3 inline mr-1 text-yellow-600" />
                <span className="font-medium">402 Payment Required</span>
                <p className="text-muted-foreground mt-1">Pay {pricePerCall} sat to access this endpoint. Your wallet will pay and retry automatically.</p>
              </div>
              <Button className="w-full" onClick={handlePay}>
                Pay {pricePerCall} sat + Retry
              </Button>
            </div>
          )}
          {state === "paying" && (
            <div className="flex items-center gap-2 justify-center py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Paying invoice and retrying...
            </div>
          )}
          {state === "paid" && (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-2 text-xs">
              <Unlock className="h-3 w-3 inline mr-1 text-green-600" />
              <Badge variant="outline" className="text-green-600">200 OK — Access granted</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Unlock className="h-4 w-4" /> API Response</CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Pay the invoice to unlock the catalog data
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="outline" className="text-green-600">✓ Paid — catalog returned</Badge>
              <div className="space-y-2">
                {data.products.map(p => (
                  <div key={p.id} className="rounded border p-2 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="text-muted-foreground">{p.price} {p.currency} · {p.stock} in stock</p>
                    </div>
                    <Badge variant="secondary">{p.id}</Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">AI agents can discover this endpoint via kind 30078, pay per query, and consume the data autonomously.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
