import { useState } from "react";
import { User, Copy, Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {} from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";
import { verifyNip05 } from "@/lib/nostr";

export function NostrIdentityScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <IdentityPanel />
      <ProfilePanel />
    </div>
  );
}

function IdentityPanel() {
  return (
    <div className="space-y-4">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">What just happened?</p>
        <p>A secp256k1 keypair was generated in your browser. The private key (nsec) is stored locally — never sent to any server. The public key (npub) is your permanent Nostr identity.</p>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const [name, setName] = useState("Alice's Candles");
  const [about, setAbout] = useState("Handmade soy wax candles. Ships in 2 days.");
  const [lud16, setLud16] = useState("");
  const [nip05, setNip05] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [nip05Valid, setNip05Valid] = useState<boolean | null>(null);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  const { getPrivateKey, getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const identity = getIdentity("merchant");

  const handlePublish = async () => {
    const privateKey = getPrivateKey("merchant");
    if (!privateKey) return;
    setIsPublishing(true);


    try {
      await publishNostrEvent("merchant", {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name, about, lud16, nip05: nip05 || undefined }),
      });
      addFlowStep({ fromWallet: "merchant", toWallet: "relay", label: "kind 0 → 3 relays", direction: "right", status: "success" });
      addTransaction({ type: "nostr_event_published", status: "success", description: `Profile published: ${name}` });
      setPublished(true);
    } catch (e: unknown) {
      addTransaction({ type: "nostr_event_published", status: "error", description: String(e) });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleVerifyNip05 = async () => {
    if (!identity || !nip05) return;
    setIsVerifying(true);
    const valid = await verifyNip05(nip05, identity.publicKey);
    setNip05Valid(valid);
    setIsVerifying(false);
  };

  const handleCopyNpub = async () => {
    if (!identity) return;
    await navigator.clipboard.writeText(identity.npub);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" /> Publish Profile (kind 0)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Display Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">About</label>
          <Input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="About you" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Lightning Address (lud16)</label>
          <Input value={lud16} onChange={(e) => setLud16(e.target.value)} placeholder="alice@getalby.com" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">NIP-05 Identifier</label>
            <Input value={nip05} onChange={(e) => setNip05(e.target.value)} placeholder="alice@alicecandles.com" />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={handleVerifyNip05} disabled={!identity || !nip05 || isVerifying}>
              <Globe className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {nip05Valid !== null && (
          <div className={`text-xs ${nip05Valid ? "text-green-600" : "text-red-500"}`}>
            {nip05Valid ? "✅ NIP-05 verified" : "❌ NIP-05 check failed"}
          </div>
        )}
        <Button className="w-full" onClick={handlePublish} disabled={!identity || isPublishing}>
          {isPublishing ? "Publishing..." : "Publish Profile"}
        </Button>
        {published && identity && (
          <div className="flex items-center gap-2 rounded bg-muted px-2 py-1">
            <span className="flex-1 truncate font-mono text-xs">{identity.npub}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopyNpub}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
