import { useState } from "react";
import { AlertTriangle, Flag, Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";
import { publishReport, type ReportReason } from "@/lib/nostr";
import { verifyEventOnRelay } from "@/lib/verification";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "illegal", label: "Illegal" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

export function NostrReportScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReporterPanel />
      <ReputationPanel />
    </div>
  );
}

interface ReportEntry { reason: ReportReason; comment: string; reportedPubkey: string; reporterNpub: string; eventId: string; }
let reports: ReportEntry[] = [];
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

function ReporterPanel() {
  const [reason, setReason] = useState<ReportReason>("scam");
  const [comment, setComment] = useState("Took payment, never delivered the candles. No response to messages.");
  const [customPubkey, setCustomPubkey] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  const { getPrivateKey, getIdentity } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const reporterIdentity = getIdentity("reporter");
  const merchantIdentity = getIdentity("merchant");

  const targetPubkey = customPubkey || merchantIdentity?.publicKey || "a".repeat(64);

  const handleReport = async () => {
    const privkey = getPrivateKey("reporter");
    if (!privkey) return;
    setIsReporting(true);
    try {
      const result = await publishReport(targetPubkey, reason, comment, privkey);
      const eventId = result.event.id;
      const verified = await verifyEventOnRelay(eventId, targetPubkey, 1984, 4000);
      reports = [...reports, { reason, comment, reportedPubkey: targetPubkey, reporterNpub: reporterIdentity?.npub ?? "", eventId }];
      notify();
      addTransaction({ type: "nostr_report_published", status: "success", description: `kind 1984 report published — reason: ${reason} — relay ${verified ? "confirmed" : "verification pending"}` });
      addFlowStep({ fromWallet: "reporter", toWallet: "relay", label: "kind 1984 → relays (permanent)", direction: "right", status: "success" });
    } catch (e) {
      addTransaction({ type: "nostr_report_published", status: "error", description: String(e) });
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="reporter" label="Carol (Reporter)" emoji="👩‍🦰" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Flag className="h-4 w-4" /> Report Bad Actor (kind 1984)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Report reason</label>
            <div className="flex flex-wrap gap-1">
              {REASONS.map(r => (
                <button key={r.value} onClick={() => setReason(r.value)} className={`px-2 py-1 rounded text-xs border ${reason === r.value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{r.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Reported pubkey (defaults to Alice)</label>
            <Input value={customPubkey} onChange={e => setCustomPubkey(e.target.value)} placeholder="Leave empty to use Alice's pubkey" className="font-mono text-xs" />
          </div>
          <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Describe what happened..." />
          <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            This report will be published permanently to relays. The reported pubkey cannot delete it.
          </div>
          <Button className="w-full" variant="destructive" onClick={handleReport} disabled={!reporterIdentity || isReporting}>
            {isReporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</> : "Publish Report"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReputationPanel() {
  const [, forceUpdate] = useState({});
  useState(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm"><ShieldOff className="h-4 w-4" /> Reputation Record</CardTitle>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No reports yet. Publish one on the left.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r, i) => (
              <div key={i} className="rounded border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="destructive" className="text-xs">{r.reason}</Badge>
                  <span className="text-xs text-muted-foreground">Permanent on relays</span>
                </div>
                <p className="text-sm">{r.comment}</p>
                <p className="text-xs text-muted-foreground">Reported pubkey: <span className="font-mono">{r.reportedPubkey.slice(0, 16)}...</span></p>
                <p className="text-xs text-muted-foreground">By: <span className="font-mono">{r.reporterNpub.slice(0, 16)}...</span></p>
              </div>
            ))}
            <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
              These reports follow the pubkey permanently. Creating a new account doesn't help — the old pubkey is tainted.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
