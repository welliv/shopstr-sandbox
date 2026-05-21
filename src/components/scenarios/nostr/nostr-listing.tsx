import { useState } from "react";
import { ShoppingBag, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {} from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";
import { buildListingTemplate } from "@/lib/nostr";

export function NostrListingScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <ListingPanel />
    </div>
  );
}

function ListingPanel() {
  const [dTag, setDTag] = useState("lavender-soy-8oz");
  const [title, setTitle] = useState("Lavender Soy Candle");
  const [summary, setSummary] = useState("8oz hand-poured, 40–50 hour burn");
  const [price, setPrice] = useState("18.00");
  const [currency, setCurrency] = useState("USD");
  const [image, setImage] = useState("https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=400");
  const [content, setContent] = useState("Handmade in small batches using 100% soy wax. Lavender essential oil.\n\nEach candle burns 40-50 hours.");
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [_publishedEvent, _setPublishedEvent] = useState<Record<string, unknown> | null>(null);

  const { getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const identity = getIdentity("merchant");

  const handlePublish = async () => {
    if (!identity) return;
    setIsPublishing(true);

    const template = buildListingTemplate({
      dTag,
      title,
      summary,
      content,
      price: { amount: price, currency },
      images: image ? [image] : [],
      categories: ["candles", "handmade"],
    });

    try {
      await publishNostrEvent("merchant", template);
      addFlowStep({ fromWallet: "merchant", toWallet: "relay", label: "kind 30402 → relays", direction: "right", status: "success" });
      addTransaction({ type: "nostr_listing_published", status: "success", description: `Listed: ${title} — ${price} ${currency}` });

      // Build shareable naddr link
      const { naddrEncode } = await import("nostr-tools/nip19");
      const naddr = naddrEncode({ kind: 30402, pubkey: identity.publicKey, identifier: dTag, relays: ["wss://relay.damus.io"] });
      setShareableLink(`https://njump.me/${naddr}`);
    } catch (e: unknown) {
      addTransaction({ type: "nostr_listing_published", status: "error", description: String(e) });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShoppingBag className="h-4 w-4" /> Publish Listing (kind 30402)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Listing ID (d-tag)</label>
            <Input value={dTag} onChange={(e) => setDTag(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <label className="text-xs text-muted-foreground">Price</label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Currency</label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Summary</label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Description (Markdown)</label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Image URL</label>
          <Input value={image} onChange={(e) => setImage(e.target.value)} />
        </div>
        <Button className="w-full" onClick={handlePublish} disabled={!identity || isPublishing}>
          {isPublishing ? "Publishing to relays..." : "Publish Listing"}
        </Button>
        {shareableLink && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded bg-green-500/10 border border-green-500/20 px-3 py-2">
              <span className="flex-1 truncate font-mono text-xs text-green-700">{shareableLink}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={async () => {
                await navigator.clipboard.writeText(shareableLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
              <a href={shareableLink} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Opens in any Nostr client (njump.me). Only Alice (holder of the private key) can update or delete this listing.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
