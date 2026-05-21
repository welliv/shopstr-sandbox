import { useState } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NostrIdentityCard } from "@/components/nostr";
import { useNostrStore, useTransactionStore } from "@/stores";


interface QAEntry { type: "question" | "answer"; content: string; author: string; eventId: string; }
let thread: QAEntry[] = [];
let lastQuestionId = "";
const listeners = new Set<() => void>();
function notify() { listeners.forEach(l => l()); }

export function NostrQAScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BuyerPanel />
      <MerchantPanel />
    </div>
  );
}

function BuyerPanel() {
  const [question, setQuestion] = useState("How long does the lavender candle burn?");
  const [isPosting, setIsPosting] = useState(false);
  const { getPrivateKey, getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const buyerIdentity = getIdentity("buyer");

  const handlePostQuestion = async () => {
    const privkey = getPrivateKey("buyer");
    if (!privkey) return;
    setIsPosting(true);
    try {
      const result = await publishNostrEvent("buyer", {
        kind: 1111,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["K", "30402"], ["E", "listing-event-id", "wss://relay.damus.io", getIdentity("merchant")?.publicKey ?? ""]],
        content: question,
      });
      lastQuestionId = result.event.id;
      thread = [...thread, { type: "question", content: question, author: (buyerIdentity?.npub?.slice(0, 12) || "buyer") + "...", eventId: result.event.id }];
      notify();
      addTransaction({ type: "nostr_event_published", status: "success", description: `kind 1111 question published` });
      addFlowStep({ fromWallet: "buyer", toWallet: "relay", label: "kind 1111 question → relays", direction: "right", status: "success" });
      setQuestion("");
    } catch (e) {
      addTransaction({ type: "nostr_event_published", status: "error", description: String(e) });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" /> Ask a Question (kind 1111)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about the product..." />
          <Button className="w-full" onClick={handlePostQuestion} disabled={!question || isPosting || !buyerIdentity}>
            {isPosting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting...</> : <><Send className="mr-2 h-4 w-4" />Post Question</>}
          </Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {thread.map((entry, i) => (
          <div key={i} className={`rounded border p-3 text-sm ${entry.type === "question" ? "bg-muted/30" : "bg-green-500/5 border-green-500/20 ml-4"}`}>
            <p className="text-xs text-muted-foreground mb-1">{entry.type === "question" ? "Q:" : "A:"} <span className="font-mono">{entry.author}</span></p>
            <p>{entry.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MerchantPanel() {
  const [answer, setAnswer] = useState("40–50 hours burn time, tested in-house.");
  const [isPosting, setIsPosting] = useState(false);
  const { getIdentity, publishNostrEvent } = useNostrStore();
  const { addTransaction, addFlowStep } = useTransactionStore();
  const merchantIdentity = getIdentity("merchant");

  const handlePostAnswer = async () => {
    if (!lastQuestionId) return;
    setIsPosting(true);
    try {
      const result = await publishNostrEvent("merchant", {
        kind: 1111,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["e", lastQuestionId, "wss://relay.damus.io", "reply"], ["p", getIdentity("buyer")?.publicKey ?? ""]],
        content: answer,
      });
      thread = [...thread, { type: "answer", content: answer, author: (merchantIdentity?.npub?.slice(0, 12) || "merchant") + "...", eventId: result.event.id }];
      notify();
      addTransaction({ type: "nostr_event_published", status: "success", description: "kind 1111 answer published — permanent on relays" });
      addFlowStep({ fromWallet: "merchant", toWallet: "relay", label: "kind 1111 answer → relays", direction: "right", status: "success" });
      setAnswer("");
    } catch (e) {
      addTransaction({ type: "nostr_event_published", status: "error", description: String(e) });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      <NostrIdentityCard role="merchant" label="Alice (Merchant)" emoji="👩" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Send className="h-4 w-4" /> Answer (kind 1111 reply)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {thread.filter(e => e.type === "question").length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No questions yet...</p>
          ) : (
            <>
              <div className="rounded bg-muted/40 p-2 text-xs">
                <p className="text-muted-foreground">Latest question:</p>
                <p className="font-medium mt-1">{thread.filter(e => e.type === "question").slice(-1)[0]?.content}</p>
              </div>
              <Input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Your answer..." />
              <Button className="w-full" onClick={handlePostAnswer} disabled={!answer || isPosting || !merchantIdentity}>
                {isPosting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting...</> : "Publish Answer"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
