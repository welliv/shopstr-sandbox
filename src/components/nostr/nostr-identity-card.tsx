/**
 * NostrIdentityCard — displays a Nostr keypair identity for sandbox scenarios.
 * Shows role label, npub (truncated), connection status, and generate button.
 */
import { useState } from "react";
import { Key, RefreshCw, Copy, Check, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNostrStore } from "@/stores";

interface NostrIdentityCardProps {
  role: string;         // "merchant" | "buyer" | "arbitrator"
  label: string;        // "Alice (Merchant)"
  emoji: string;
}

export function NostrIdentityCard({ role, label, emoji }: NostrIdentityCardProps) {
  const [copied, setCopied] = useState(false);
  const { generateIdentityForRole, getIdentity } = useNostrStore();
  const identity = getIdentity(role);

  const handleGenerate = () => {
    generateIdentityForRole(role, label, emoji);
  };

  const handleCopyNpub = async () => {
    if (!identity) return;
    await navigator.clipboard.writeText(identity.npub);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncate = (s: string, n = 16) =>
    s.length > n * 2 ? `${s.slice(0, n)}...${s.slice(-8)}` : s;

  return (
    <Card className={identity ? "border-green-500/30 bg-green-500/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span className="text-lg">{emoji}</span>
            {label}
          </span>
          {identity ? (
            <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
              <Shield className="mr-1 h-3 w-3" /> Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              No Identity
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {identity ? (
          <>
            <div className="flex items-center gap-1 rounded bg-muted px-2 py-1">
              <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                {truncate(identity.npub, 12)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={handleCopyNpub}
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleGenerate}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Regenerate
            </Button>
          </>
        ) : (
          <Button className="w-full" size="sm" onClick={handleGenerate}>
            <Key className="mr-2 h-4 w-4" />
            Generate Identity
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
