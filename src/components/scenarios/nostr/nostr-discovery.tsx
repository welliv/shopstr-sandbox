import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NostrIdentityCard } from "@/components/nostr";
import { useTransactionStore } from "@/stores";
import { fetchEvents } from "@/lib/nostr";
import type { Event as NostrEvent } from "nostr-tools";
import { EventVerifyLink } from "@/components/nostr/verification-badges";

export function NostrDiscoveryScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NostrIdentityCard role="buyer" label="Bob (Buyer)" emoji="👨‍🦱" />
      <SearchPanel />
    </div>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState("candle");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<NostrEvent[]>([]);
  const [searched, setSearched] = useState(false);
  const { addTransaction } = useTransactionStore();

  const handleSearch = async () => {
    setIsSearching(true);
    setSearched(true);
    addTransaction({ type: "nostr_event_published", status: "pending", description: `NIP-50 search: "${query}"` });
    try {
      const events = await fetchEvents(
        [{ kinds: [30402], search: query, limit: 10 }],
        ["wss://relay.nostr.band", "wss://relay.primal.net"],
        6000
      );
      setResults(events);
      addTransaction({ type: "nostr_event_published", status: "success", description: `Found ${events.length} listings for "${query}"` });
    } catch (e: unknown) {
      addTransaction({ type: "nostr_event_published", status: "error", description: String(e) });
    } finally {
      setIsSearching(false);
    }
  };

  const getTag = (event: NostrEvent, key: string) =>
    event.tags.find((t) => t[0] === key)?.[1] ?? "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4" /> NIP-50 Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search listings..." onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
          <Button onClick={handleSearch} disabled={isSearching}>{isSearching ? "Searching..." : "Search"}</Button>
        </div>
        <div className="rounded bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
          {`["REQ", "sub1", {"search": "${query}", "kinds": [30402]}]`}
        </div>
        <div className="text-xs text-muted-foreground">Querying: relay.nostr.band, relay.primal.net (NIP-50 capable)</div>
        {searched && !isSearching && (
          <div className="space-y-2">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No listings found. Try a different query, or publish a listing first (Scenario 2).</p>
            ) : (
              results.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded border p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{getTag(event, "title") || "Untitled"}</span>
                    <Badge variant="secondary" className="text-xs">{getTag(event, "price") ? `${getTag(event, "price")}` : "—"}</Badge>
                  </div>
                  <p className="text-muted-foreground truncate">{getTag(event, "summary")}</p>
                  <p className="font-mono text-muted-foreground">{event.pubkey.slice(0, 16)}... · <EventVerifyLink eventId={event.id} /></p>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
