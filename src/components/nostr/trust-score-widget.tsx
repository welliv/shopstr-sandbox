/**
 * TrustScoreWidget — displays a Fibonacci-weighted trust score (0-20).
 * Used in the Seller Verification scenario.
 */
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeTrustScore, type TrustSignals, MAX_TRUST_SCORE } from "@/lib/nostr";

interface TrustScoreWidgetProps {
  signals: TrustSignals;
}

export function TrustScoreWidget({ signals }: TrustScoreWidgetProps) {
  const result = computeTrustScore(signals);

  const tierConfig = {
    unknown: { icon: ShieldQuestion, color: "text-muted-foreground", badge: "secondary", label: "Unknown" },
    low: { icon: ShieldAlert, color: "text-red-500", badge: "destructive", label: "Low Trust" },
    moderate: { icon: Shield, color: "text-yellow-500", badge: "outline", label: "Moderate" },
    high: { icon: ShieldCheck, color: "text-blue-500", badge: "outline", label: "High Trust" },
    verified: { icon: ShieldCheck, color: "text-green-500", badge: "outline", label: "Verified" },
  } as const;

  const cfg = tierConfig[result.tier];
  const TierIcon = cfg.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <TierIcon className={`h-4 w-4 ${cfg.color}`} />
            Trust Score
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{result.score}</span>
            <span className="text-muted-foreground text-xs">/ {MAX_TRUST_SCORE}</span>
            <Badge variant={cfg.badge as "secondary" | "destructive" | "outline"} className="text-xs">
              {cfg.label}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              result.tier === "verified" ? "bg-green-500" :
              result.tier === "high" ? "bg-blue-500" :
              result.tier === "moderate" ? "bg-yellow-500" :
              result.tier === "low" ? "bg-red-500" : "bg-muted-foreground"
            }`}
            style={{ width: `${result.percentage}%` }}
          />
        </div>

        {/* Signal breakdown */}
        <div className="space-y-1">
          {result.breakdown.map((item) => (
            <div key={item.signal} className="flex items-center justify-between text-xs">
              <span className={item.earned > 0 ? "text-foreground" : "text-muted-foreground line-through"}>
                {item.signal}
              </span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-muted-foreground">
                  {item.earned > 0 ? `+${item.earned}` : `+0`}/{item.weight}
                </span>
                <span className={item.earned > 0 ? "text-green-500" : "text-muted-foreground"}>
                  {item.earned > 0 ? "✓" : "○"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {result.tier === "unknown" || result.tier === "low" ? (
          <p className="text-xs text-muted-foreground border-t pt-2">
            ⚠️ Low trust score — recommend using escrow for this merchant.
          </p>
        ) : result.tier === "verified" ? (
          <p className="text-xs text-green-600 border-t pt-2">
            ✅ All signals verified — escrow optional for small orders.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
