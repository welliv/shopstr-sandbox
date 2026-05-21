import {
  BotIcon,
  CodeIcon,
  DropletsIcon,
  ExternalLink,
  HelpCircleIcon,
  LightbulbIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { scenarios } from "@/data/scenarios";
import { BitcoinConnectIcon } from "@/icons/BitcoinConnectIcon";

const externalLinks = [
  { title: "Nostr Commerce Skill", url: "https://github.com/welliv/nostr-commerce-skill", icon: <BotIcon className="size-4" /> },
  { title: "NWC Faucet", url: "https://faucet.nwc.dev", icon: <DropletsIcon className="size-4" /> },
  { title: "Sandbox Source", url: "https://github.com/shopstr-eng/shopstr-sandbox", icon: <CodeIcon className="size-4" /> },
  { title: "Feedback", url: "https://shopstr.store", icon: <LightbulbIcon className="size-4" /> },
  { title: "Help", url: "https://github.com/welliv/nostr-commerce-skill", icon: <HelpCircleIcon className="size-4" /> },
];

const NOSTR_CHAPTERS = [
  { label: "Foundation", ids: ["nostr-identity","nostr-listing","nostr-expiration","nostr-discovery","nostr-verification"] },
  { label: "Commerce", ids: ["nostr-encrypted-order","nostr-direct-payment","nostr-escrow","nostr-proof-of-payment","nostr-reviews","nostr-qa","nostr-report"] },
  { label: "Trust", ids: ["nostr-zaps","nostr-prisms","nostr-subscriptions","nostr-cart","nostr-platform-fees"] },
  { label: "Advanced", ids: ["nostr-zapvertising","nostr-fiat","nostr-l402","nostr-notifications","nostr-disputes"] },
];

export function AppSidebar() {
  const location = useLocation();
  const scenarioId = location.pathname.split("/").filter(Boolean)[0];

  const lightningScenarios = scenarios.filter(s => !s.section || s.section === "scenarios");
  const fourzerotwoScenarios = scenarios.filter(s => s.section === "402");
  const bitcoinConnectScenarios = scenarios.filter(s => s.section === "bitcoin-connect");
  const nostrScenarioMap = Object.fromEntries(
    scenarios.filter(s => s.section === "nostr").map(s => [s.id, s])
  );

  return (
    <Sidebar>
      <SidebarHeader className="">
        <div className="flex items-center gap-2">
          <ShoppingBagIcon className="size-6 text-purple-500" />
          <div>
            <h1 className="font-semibold">Shopstr Sandbox</h1>
            <p className="text-xs text-muted-foreground">Explore Nostr Commerce Scenarios</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        {/* ── Lightning Scenarios ──────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-widest text-muted-foreground">
            ⚡ Lightning
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {lightningScenarios.map(scenario => (
                <SidebarMenuItem key={scenario.id}>
                  <SidebarMenuButton asChild isActive={scenarioId === scenario.id}>
                    <Link to={`/${scenario.id}`}>
                      <span>{scenario.icon}</span>
                      <span>{scenario.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Nostr Commerce ───────────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-widest text-muted-foreground">
            🛍️ Nostr Commerce
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {NOSTR_CHAPTERS.map(chapter => (
              <div key={chapter.label} className="mb-2">
                <p className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                  {chapter.label}
                </p>
                <SidebarMenu>
                  {chapter.ids.map(id => {
                    const scenario = nostrScenarioMap[id];
                    if (!scenario) return null;
                    return (
                      <SidebarMenuItem key={id}>
                        <SidebarMenuButton asChild isActive={scenarioId === id}>
                          <Link to={`/${id}`}>
                            <span>{scenario.icon}</span>
                            <span>{scenario.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── 402 ─────────────────────────────────────────────────────────── */}
        {fourzerotwoScenarios.length > 0 && (
          <SidebarGroup className="-mt-4">
            <SidebarGroupLabel className="text-xs font-semibold tracking-widest text-muted-foreground">
              402
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {fourzerotwoScenarios.map(scenario => (
                  <SidebarMenuItem key={scenario.id}>
                    <SidebarMenuButton asChild isActive={scenarioId === scenario.id}>
                      <Link to={`/${scenario.id}`}>
                        <span>{scenario.icon}</span>
                        <span>{scenario.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Bitcoin Connect ──────────────────────────────────────────────── */}
        <SidebarGroup className="-mt-4">
          <SidebarGroupLabel className="-mb-1">
            <div title="Bitcoin Connect: let bitcoin surf the web" className="pointer-events-none">
              <BitcoinConnectIcon className="size-20" />
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {bitcoinConnectScenarios.map(scenario => (
                <SidebarMenuItem key={scenario.id}>
                  <SidebarMenuButton asChild isActive={scenarioId === scenario.id}>
                    <Link to={`/${scenario.id}`}>
                      <span>{scenario.icon}</span>
                      <span>{scenario.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter>
        <SidebarMenu>
          {externalLinks.map(link => (
            <SidebarMenuItem key={link.url}>
              <SidebarMenuButton asChild>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <span>{link.icon}</span>
                  <span>{link.title}</span>
                  <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
