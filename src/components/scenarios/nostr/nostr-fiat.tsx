import { useState } from "react";
import { DollarSign, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getFiatValue } from "@getalby/lightning-tools/fiat";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY"] as const;
type Currency = typeof CURRENCIES[number];

interface ConversionResult { sats: number; fiatAmount: number; currency: Currency; rate: number; }

export function NostrFiatScenario() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const [fiatAmount, setFiatAmount] = useState("18.00");
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    setIsConverting(true);
    setError(null);
    try {
      // getFiatValue returns the fiat value of 1 sat in the given currency
      const oneSatInUsd = await getFiatValue({ satoshi: 1, currency: "USD" });
      // Approximate other currencies with fixed ratios (production would use real rates)
      const rates: Record<Currency, number> = {
        USD: 1, EUR: 0.92, GBP: 0.79, JPY: 155,
      };
      const btcUsdPrice = 1 / oneSatInUsd / 100_000_000;
      const fiatInUsd = parseFloat(fiatAmount) / rates[currency];
      const sats = Math.round((fiatInUsd / btcUsdPrice) * 100_000_000);
      setResult({ sats, fiatAmount: parseFloat(fiatAmount), currency, rate: btcUsdPrice });
    } catch {
      // Fallback: simulate with fixed rate
      const fallbackSatPerUsd = 3500;
      const rates: Record<Currency, number> = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 155 };
      const usdAmount = parseFloat(fiatAmount) / rates[currency];
      const sats = Math.round(usdAmount * fallbackSatPerUsd);
      setResult({ sats, fiatAmount: parseFloat(fiatAmount), currency, rate: 100_000_000 / (fallbackSatPerUsd * 100_000_000) });
      setError("Using fallback rate (CoinGecko unavailable in this environment)");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4" /> Fiat-Priced Listing (NIP-99)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border p-3 space-y-2">
            <p className="font-medium text-sm">🕯️ Lavender Soy Candle (8oz)</p>
            <p className="text-xs text-muted-foreground">Hand-poured, 40–50 hour burn. Ships in 48h.</p>
            <div className="flex items-center gap-2">
              <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="text-xs rounded border bg-background px-2 py-1">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input value={fiatAmount} onChange={e => setFiatAmount(e.target.value)} className="w-24 text-sm" type="number" step="0.01" />
            </div>
            <div className="text-xs text-muted-foreground font-mono bg-muted/40 rounded p-1">
              NIP-99 tag: [&quot;price&quot;, &quot;{fiatAmount}&quot;, &quot;{currency}&quot;]
            </div>
          </div>
          <Button className="w-full" onClick={handleConvert} disabled={isConverting}>
            {isConverting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Converting...</> : <><RefreshCw className="mr-2 h-4 w-4" />Convert at Live Rate</>}
          </Button>
          {error && <p className="text-xs text-yellow-600">{error}</p>}
          <p className="text-xs text-muted-foreground">Rate fetched at checkout time. Merchant prices in {currency}; buyer pays sats.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Checkout Amount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result ? (
            <div className="space-y-3">
              <div className="rounded border p-4 text-center space-y-2">
                <p className="text-3xl font-bold">{result.sats.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">sats</p>
                <div className="h-px bg-border" />
                <p className="text-lg">{result.fiatAmount.toFixed(2)} {result.currency}</p>
                <Badge variant="outline" className="text-xs">at current BTC/{result.currency} rate</Badge>
              </div>
              <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Flow:</p>
                <p>1. Listing stores price: [{fiatAmount}, {currency}] tag</p>
                <p>2. Client fetches BTC/{currency} rate at checkout</p>
                <p>3. Creates invoice for {result.sats.toLocaleString()} sats</p>
                <p>4. Buyer pays — volatility risk is merchant&apos;s</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Click &quot;Convert at Live Rate&quot; to see the sats amount
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
