import { useState } from "react";
import { Globe, GitBranch, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NostrIdentityCard, TrustScoreWidget } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";
import { verifyNip05, type TrustSignals } from "@/lib/nostr";
import { EventVerifyLink } from "@/components/nostr/verification-badges";
import { verifyEventOnRelay } from "@/lib/verification";

export function NostrVerificationScenario() {
  const [signals, setSignals] = useState<TrustSignals>({
    nip05Verified: false,
    hasExternalLinks: false,
    hasThirdPartyAssertions: false,
    hasVerifiedReviews: false,
    hasReceivedZaps: false,
    hasCleanReportHistory: false,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
        <TrustScoreWidget signals={signals} />
      </div>
      <VerificationPanel signals={signals} setSignals={setSignals} />
    </div>
  );
}

function VerificationPanel({ signals, setSignals }: {
  signals: TrustSignals;
  setSignals: (s: TrustSignals) => void;
}) {
  const [nip05Input, setNip05Input] = useState("alice@alicecandles.com");
  const [githubInput, setGithubInput] = useState("alice-candles");
  const [isVerifyingNip05, setIsVerifyingNip05] = useState(false);
  const [nip05Result, setNip05Result] = useState<string | null>(null);
  const [publishedEventId, setPublishedEventId] = useState<string | null>(null);
  const [assertionEventId, setAssertionEventId] = useState<string | null>(null);

  const { getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction } = useTransactionStore();
  const identity = getIdentity("merchant");

  const handleVerifyNip05 = async () => {
    if (!identity) return;
    setIsVerifyingNip05(true);
    addTransaction({ type: "nostr_event_published", status: "pending", description: `Checking NIP-05: ${nip05Input}` });
    const valid = await verifyNip05(nip05Input, identity.publicKey);
    setNip05Result(valid ? "✅ Verified — domain owner confirmed this pubkey" : "❌ Verification failed — domain server returned a different pubkey");
    setSignals({ ...signals, nip05Verified: valid });
    addTransaction({ type: "nostr_trust_computed", status: valid ? "success" : "error", description: `NIP-05 check: ${valid ? "passed" : "failed"}` });
    setIsVerifyingNip05(false);
  };

  const handleAddGithubLink = async () => {
    if (!identity) return;
    const result = await publishNostrEvent("merchant", {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["i", `github:${githubInput}`, `https://gist.github.com/${githubInput}/nostr`]],
      content: JSON.stringify({ name: "Alice", nip05: nip05Input }),
    });
    const eventId = result.event.id;
    const verified = await verifyEventOnRelay(eventId, identity.publicKey, 0, 4000);
    setPublishedEventId(eventId);
    addTransaction({ type: "nostr_trust_computed", status: verified ? "success" : "error", description: `GitHub link published — event ${verified ? "confirmed" : "pending"} on relays` });
    setSignals({ ...signals, hasExternalLinks: true });
  };

  const handleSimulateAttestation = async () => {
    if (!identity) return;
    // Simulate a NIP-85 assertion from a trusted arbitrator
    const result = await publishNostrEvent("merchant", {
      kind: 30382,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", identity.publicKey], ["k", "30402"], ["n", "true"]],
      content: "Merchant verified by Shopstr escrow service",
    });
    const eventId = result.event.id;
    const verified = await verifyEventOnRelay(eventId, identity.publicKey, 30382, 4000);
    setAssertionEventId(eventId);
    addTransaction({ type: "nostr_trust_computed", status: verified ? "success" : "error", description: `NIP-85 assertion published — event ${verified ? "confirmed" : "pending"} on relays` });
    setSignals({ ...signals, hasThirdPartyAssertions: true });
  };

  const handleSimulateReviews = () => {
    setSignals({ ...signals, hasVerifiedReviews: true });
    addTransaction({ type: "nostr_trust_computed", status: "success", description: "Simulated: 3 preimage-verified reviews found" });
  };

  const handleSimulateZaps = () => {
    setSignals({ ...signals, hasReceivedZaps: true });
    addTransaction({ type: "nostr_trust_computed", status: "success", description: "Simulated: 12 zap receipts found on listings" });
  };

  const handleSimulateCleanHistory = () => {
    setSignals({ ...signals, hasCleanReportHistory: true });
    addTransaction({ type: "nostr_trust_computed", status: "success", description: "Zero kind-1984 reports found for this pubkey" });
  };

  return (
    <div className="space-y-3">
      {/* NIP-05 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-medium">
            <Globe className="h-3 w-3" /> NIP-05 (weight: 1) — DNS Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={nip05Input} onChange={(e) => setNip05Input(e.target.value)} placeholder="alice@domain.com" className="text-sm" />
            <Button size="sm" onClick={handleVerifyNip05} disabled={!identity || isVerifyingNip05}>
              {isVerifyingNip05 ? "..." : "Verify"}
            </Button>
          </div>
          {nip05Result && <p className="text-xs">{nip05Result}</p>}
        </CardContent>
      </Card>

      {/* NIP-39 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-medium">
            <GitBranch className="h-3 w-3" /> NIP-39 (weight: 1) — External Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={githubInput} onChange={(e) => setGithubInput(e.target.value)} placeholder="GitHub username" className="text-sm" />
            <Button size="sm" onClick={handleAddGithubLink} disabled={!identity}>Add</Button>
          </div>
          {signals.hasExternalLinks && <p className="text-xs text-green-600">✅ GitHub link added to kind 0 profile</p>}
          {publishedEventId && <EventVerifyLink eventId={publishedEventId} label="verify event on njump.me" />}
        </CardContent>
      </Card>

      {/* Simulate higher signals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-medium">
            <Award className="h-3 w-3" /> Higher Trust Signals (simulate)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleSimulateAttestation} disabled={!identity}>
            NIP-85 Third-Party Assertion (weight: 2)
          </Button>
          {assertionEventId && <EventVerifyLink eventId={assertionEventId} label="verify assertion on njump.me" />}
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleSimulateReviews}>
            Verified Reviews found (weight: 3)
          </Button>
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleSimulateZaps}>
            Zaps received on listings (weight: 5)
          </Button>
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleSimulateCleanHistory}>
            Clean report history (weight: 8)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
