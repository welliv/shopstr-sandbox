import { useState, useEffect } from "react";
import { Bell, Send, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { EventVerifyLink, RelayVerifyBadge } from "@/components/nostr/verification-badges";
import { verifyEventOnRelay } from "@/lib/verification";
import { useNostrStore, useTransactionStore } from "@/stores";
import { giftWrap, unwrapGiftWrap } from "@/lib/nostr";

interface NotificationMsg { subject: string; body: string; sentAt: Date; }
let pendingWrap: ReturnType<typeof giftWrap> | null = null;
let received: NotificationMsg[] = [];
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

export function NostrNotificationsScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MerchantPanel />
      <BuyerPanel />
    </div>
  );
}

function MerchantPanel() {
  const [subject, setSubject] = useState("Order Confirmed 🕯️");
  const [body, setBody] = useState("Your lavender candle order has been confirmed and will ship within 48 hours. Thank you!");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [eventVerified, setEventVerified] = useState<boolean | undefined>(undefined);

  const { getPrivateKey, getIdentity } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const merchantIdentity = getIdentity("merchant");
  const buyerIdentity = getIdentity("buyer");

  const handleSend = () => {
    const merchantKey = getPrivateKey("merchant");
    if (!merchantKey || !buyerIdentity) return;
    setIsSending(true);
    const payload = JSON.stringify({ subject, body, sentAt: new Date().toISOString() });
    pendingWrap = giftWrap(payload, merchantKey, buyerIdentity.publicKey);
    notify();
    addTransaction({ type: "nostr_event_published", status: "success", description: `Notification sent via NIP-59 gift wrap — encrypted to buyer only` });
    addFlowStep({ fromWallet: "merchant", toWallet: "buyer", label: "kind 1059 notification", direction: "right", status: "success" });
    // Verify the gift wrap event on relay
    const eventId = pendingWrap.id;
    setLastEventId(eventId);
    verifyEventOnRelay(eventId, pendingWrap.pubkey, 1059).then(verified => {
      setEventVerified(verified);
    });
    setIsSending(false);
    setSent(true);
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Send className="h-4 w-4" /> Send Encrypted Notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Message</label>
            <Input value={body} onChange={e => setBody(e.target.value)} />
          </div>
          {!buyerIdentity && <p className="text-xs text-yellow-600">⚠️ Generate buyer identity first</p>}
          <Button className="w-full" onClick={handleSend} disabled={isSending || !merchantIdentity || !buyerIdentity}>
            {isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : "Send NIP-59 Notification"}
          </Button>
          {sent && (
            <div className="rounded border border-green-500/20 bg-green-500/5 p-2 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600">✓ Sent</Badge>
                <RelayVerifyBadge verified={eventVerified} />
              </div>
              <p>Relay sees: kind 1059 from ephemeral key, to buyer pubkey</p>
              <p className="text-muted-foreground">No email, no webhook, no plain text on the wire</p>
              {lastEventId && (
                <EventVerifyLink eventId={lastEventId} label="verify event on njump" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BuyerPanel() {
  const [, forceUpdate] = useState({});
  useEffect(() => { const l = () => forceUpdate({}); listeners.add(l); return () => { listeners.delete(l); }; }, []);

  const { getPrivateKey, getIdentity } = useNostrStore();
  const { addTransaction } = useTransactionStore();
  const buyerIdentity = getIdentity("buyer");

  const handleDecrypt = () => {
    const buyerKey = getPrivateKey("buyer");
    if (!buyerKey || !pendingWrap) return;
    try {
      const { content } = unwrapGiftWrap(pendingWrap, buyerKey);
      const msg = JSON.parse(content) as { subject: string; body: string; sentAt: string };
      received = [{ subject: msg.subject, body: msg.body, sentAt: new Date(msg.sentAt) }, ...received];
      pendingWrap = null;
      notify();
      addTransaction({ type: "nostr_order_received", status: "success", description: `Decrypted notification: ${msg.subject}` });
    } catch (e) {
      addTransaction({ type: "nostr_order_received", status: "error", description: String(e) });
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" /> Inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingWrap && (
            <div className="rounded border border-blue-500/20 bg-blue-500/5 p-2 text-xs space-y-2">
              <p className="font-medium">1 encrypted notification waiting</p>
              <p className="text-muted-foreground">kind 1059 from: <span className="font-mono">{pendingWrap.pubkey.slice(0, 16)}... (ephemeral)</span></p>
              <Button size="sm" className="w-full" onClick={handleDecrypt} disabled={!buyerIdentity}>
                Decrypt Notification
              </Button>
            </div>
          )}
          {received.length === 0 && !pendingWrap && (
            <p className="text-sm text-muted-foreground text-center py-4">No notifications yet.</p>
          )}
          <div className="space-y-2">
            {received.map((msg, i) => (
              <div key={i} className="rounded border p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">{msg.subject}</p>
                </div>
                <p className="text-xs text-muted-foreground">{msg.body}</p>
                <p className="text-xs text-muted-foreground">{msg.sentAt.toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
