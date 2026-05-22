import { useState } from "react";
import { RefreshCw, Loader2, ExternalLink, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { refreshBalance, verifyPreimageSha256 } from "@/lib/verification";

/**
 * A badge showing a wallet's live balance with a refresh button.
 * Shows "N sats" with a refresh icon; during loading shows spinner.
 */
export function BalanceBadge({ walletId, label }: { walletId: string; label?: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    const bal = await refreshBalance(walletId);
    setBalance(bal);
    setRefreshing(false);
  };

  return (
    <div className="flex items-center gap-1">
      {balance != null && (
        <Badge variant="outline" className="text-xs font-mono">
          {balance.toLocaleString()} sats
        </Badge>
      )}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className={`h-5 w-5 p-0 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors ${refreshing ? "opacity-50" : ""}`}
        title={`Refresh ${label ?? walletId} balance`}
      >
        {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      </button>
    </div>
  );
}

/**
 * Verifies SHA256(preimage) === paymentHash and shows result.
 * Auto-verifies if both values are provided.
 */
export function PreimageProof({
  preimage,
  paymentHash,
  autoVerify = true,
}: {
  preimage: string;
  paymentHash: string;
  autoVerify?: boolean;
}) {
  const [result, setResult] = useState<{ valid: boolean; computedHash: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (!preimage || !paymentHash) return;
    setVerifying(true);
    const r = await verifyPreimageSha256(preimage, paymentHash);
    setResult(r);
    setVerifying(false);
  };

  // Auto-verify on mount/props change
  if (autoVerify && !result && !verifying && preimage && paymentHash) {
    handleVerify();
  }

  return (
    <div className="text-xs space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">preimage:</span>
        <span className="font-mono text-[10px] break-all">{preimage.slice(0, 20)}...</span>
        {!result && (
          <button
            onClick={handleVerify}
            disabled={verifying || !preimage || !paymentHash}
            className="text-primary underline ml-1"
          >
            {verifying ? "verifying..." : "verify SHA256"}
          </button>
        )}
      </div>
      {result && (
        <div className={`flex items-center gap-1 ${result.valid ? "text-green-600" : "text-red-600"}`}>
          {result.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          <span>
            {result.valid
              ? "SHA256(preimage) === paymentHash — cryptographic proof of payment ✓"
              : "Preimage does not match payment hash"}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A link to verify an event on njump.me.
 */
export function EventVerifyLink({ eventId, label }: { eventId: string; label?: string }) {
  if (!eventId) return null;
  return (
    <a
      href={`https://njump.me/${eventId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
    >
      {label ?? "verify on njump.me"}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

/**
 * A verification badge that shows whether an event was confirmed on relays.
 */
export function RelayVerifyBadge({ verified }: { verified: boolean | undefined }) {
  if (verified === undefined) return null;
  return (
    <Badge variant="outline" className={`text-[10px] ${verified ? "text-green-600" : "text-yellow-600"}`}>
      {verified ? "✓ relay-confirmed" : "pending relay verification..."}
    </Badge>
  );
}
