import { useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {} from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";
import { buildListingTemplate } from "@/lib/nostr";

const PRESETS = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
  { label: "30 days", seconds: 2592000 },
];

export function NostrExpirationScenario() {
  const [title, setTitle] = useState("Flash Sale: Lavender Candle");
  const [price, setPrice] = useState("12.00");
  const [hoursUntilExpiry, setHoursUntilExpiry] = useState("24");
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState<{ expiresAt: number } | null>(null);

  const { getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const identity = getIdentity("merchant");

  const expiresAt = Math.floor(Date.now() / 1000) + parseInt(hoursUntilExpiry) * 3600;
  const expiresDate = new Date(expiresAt * 1000);

  const handlePublish = async () => {
    if (!identity) return;
    setIsPublishing(true);
    try {
      const template = buildListingTemplate({
        dTag: `flash-sale-${Date.now()}`,
        title,
        summary: `Flash sale — expires ${expiresDate.toLocaleString()}`,
        content: "Limited time offer!",
        price: { amount: price, currency: "USD" },
        expiresAt,
      });
      await publishNostrEvent("merchant", template);
      addFlowStep({ fromWallet: "merchant", toWallet: "relay", label: `kind 30402 + expiration`, direction: "right", status: "success" });
      addTransaction({ type: "nostr_listing_published", status: "success", description: `Flash sale listing expires ${expiresDate.toLocaleDateString()}` });
      setPublished({ expiresAt });
    } catch (e: unknown) {
      addTransaction({ type: "nostr_listing_published", status: "error", description: String(e) });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" /> Time-Bound Listing (NIP-40)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Flash Sale Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sale Price (USD)</label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Expiry Duration</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p.label} variant={hoursUntilExpiry === String(p.seconds / 3600) ? "default" : "outline"} size="sm" className="text-xs"
                  onClick={() => setHoursUntilExpiry(String(p.seconds / 3600))}>
                  {p.label}
                </Button>
              ))}
            </div>
            <Input value={hoursUntilExpiry} onChange={(e) => setHoursUntilExpiry(e.target.value)} type="number" placeholder="Custom hours" />
          </div>
          <div className="rounded bg-muted/50 p-2 text-xs">
            <p className="text-muted-foreground">Expires at:</p>
            <p className="font-mono">{expiresDate.toLocaleString()}</p>
            <p className="mt-1 text-muted-foreground font-mono">["expiration", "{expiresAt}"]</p>
          </div>
          <Button className="w-full" onClick={handlePublish} disabled={!identity || isPublishing}>
            {isPublishing ? "Publishing..." : "Publish Flash Sale Listing"}
          </Button>
          {published && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-yellow-700">
                <AlertTriangle className="h-3 w-3" /> Listing published with expiration
              </div>
              <p className="mt-1 text-muted-foreground">After {expiresDate.toLocaleString()}, compliant relays will stop serving this event. No backend required — the deadline is baked into the event's cryptographic signature.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
