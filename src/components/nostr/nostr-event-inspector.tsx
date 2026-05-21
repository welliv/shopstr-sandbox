/**
 * NostrEventInspector — shows raw Nostr events published during a scenario.
 * Used in the 5th visualization tab "Nostr Events".
 */
import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNostrStore } from "@/stores";
import { kindName } from "@/lib/nostr";
import { verifyEvent } from "nostr-tools";

interface InspectorEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

export function NostrEventInspector() {
  const { publishedEvents, clearEvents } = useNostrStore();

  if (publishedEvents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        No Nostr events published yet. Run a scenario to see events here.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="font-medium">Nostr Events</h3>
        <Button variant="ghost" size="sm" onClick={clearEvents}>
          Clear
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="space-y-2 p-4">
          {[...publishedEvents].reverse().map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: InspectorEvent }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isValid = verifyEvent(event as Parameters<typeof verifyEvent>[0]);
  const kind = event.kind;
  const createdAt = new Date(event.created_at * 1000);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const kindColors: Record<number, string> = {
    0: "bg-blue-500/10 text-blue-600",
    30402: "bg-green-500/10 text-green-600",
    1059: "bg-purple-500/10 text-purple-600",
    13: "bg-purple-500/10 text-purple-600",
    9734: "bg-yellow-500/10 text-yellow-700",
    9735: "bg-yellow-500/10 text-yellow-700",
    1984: "bg-red-500/10 text-red-600",
    1111: "bg-cyan-500/10 text-cyan-600",
    30382: "bg-indigo-500/10 text-indigo-600",
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-3">
        <Badge
          variant="outline"
          className={`shrink-0 text-xs font-mono ${kindColors[kind] ?? ""}`}
        >
          {kind}
        </Badge>
        <span className="flex-1 truncate text-sm font-medium">
          {kindName(kind)}
        </span>
        <span className="text-xs text-muted-foreground">
          {createdAt.toLocaleTimeString()}
        </span>
        {isValid ? (
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Tags summary */}
      <div className="flex flex-wrap gap-1 border-t px-3 py-2">
        {(event.tags ?? []).slice(0, 6).map((tag, i) => (
          <Badge key={i} variant="secondary" className="font-mono text-xs">
            {tag[0]}: {String(tag[1] ?? "").slice(0, 12)}
            {(tag[1] ?? "").length > 12 ? "…" : ""}
          </Badge>
        ))}
      </div>

      {expanded && (
        <div className="border-t">
          <pre className="overflow-x-auto rounded-b-lg bg-muted p-3 text-xs leading-relaxed">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
