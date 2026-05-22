import { useScenarioStore } from "@/stores";
import {
  SimplePaymentScenario,
  LookupInvoiceScenario,
  LightningAddressScenario,
  NotificationsScenario,
  SubscriptionPaymentsScenario,
  HoldInvoiceScenario,
  TransactionHistoryScenario,
  ProofOfPaymentScenario,
  DecodeBolt11InvoiceScenario,
  FiatConversionScenario,
  PaymentForwardingScenario,
  PaymentPrismsScenario,
  LnurlVerifyScenario,
  WrappedInvoicesScenario,
} from "./scenarios";
import {
  BitcoinConnectButtonScenario,
  ConnectWalletScenario,
  PayButtonScenario,
  PaymentModalScenario,
} from "./bitcoin-connect";
import { L402FetchScenario, X402FetchScenario, MPPFetchScenario } from "./402";
import {
  NostrIdentityScenario, NostrListingScenario, NostrExpirationScenario,
  NostrDiscoveryScenario, NostrVerificationScenario, NostrEncryptedOrderScenario,
  NostrDirectPaymentScenario, NostrEscrowScenario, NostrProofOfPaymentScenario,
  NostrReviewsScenario, NostrQAScenario, NostrReportScenario, NostrZapsScenario,
  NostrPrismsScenario, NostrSubscriptionsScenario, NostrCartScenario,
  NostrPlatformFeesScenario, NostrZapvertisingScenario, NostrFiatScenario,
  NostrL402Scenario, NostrNotificationsScenario, NostrDisputesScenario,
} from "./scenarios/nostr";
import { FoundationScenario } from "./scenarios/nostr-foundation";

export function ScenarioPanel() {
  const { currentScenario } = useScenarioStore();

  switch (currentScenario.id) {
    case "simple-payment":
      return <SimplePaymentScenario />;
    case "lookup-invoice":
      return <LookupInvoiceScenario />;
    case "lightning-address":
      return <LightningAddressScenario />;
    case "notifications":
      return <NotificationsScenario />;
    case "subscription-payments":
      return <SubscriptionPaymentsScenario />;
    case "hold-invoice":
      return <HoldInvoiceScenario />;
    case "transaction-history":
      return <TransactionHistoryScenario />;
    case "proof-of-payment":
      return <ProofOfPaymentScenario />;
    case "decode-bolt11-invoice":
      return <DecodeBolt11InvoiceScenario />;
    case "fiat-conversion":
      return <FiatConversionScenario />;
    case "payment-forwarding":
      return <PaymentForwardingScenario />;
    case "payment-prisms":
      return <PaymentPrismsScenario />;
    case "lnurl-verify":
      return <LnurlVerifyScenario />;
    case "wrapped-invoices":
      return <WrappedInvoicesScenario />;
    case "bitcoin-connect-button":
      return <BitcoinConnectButtonScenario />;
    case "connect-wallet":
      return <ConnectWalletScenario />;
    case "pay-button":
      return <PayButtonScenario />;
    case "payment-modal":
      return <PaymentModalScenario />;
    case "l402-fetch":
      return <L402FetchScenario />;
    case "x402-fetch":
      return <X402FetchScenario />;
    case "mpp-fetch":
      return <MPPFetchScenario />;
    // ── Nostr Commerce ────────────────────────────────────────────────────────
    case "foundation":
      return <FoundationScenario />;
    case "nostr-identity":
      return <NostrIdentityScenario />;
    case "nostr-listing":
      return <NostrListingScenario />;
    case "nostr-expiration":
      return <NostrExpirationScenario />;
    case "nostr-discovery":
      return <NostrDiscoveryScenario />;
    case "nostr-verification":
      return <NostrVerificationScenario />;
    case "nostr-encrypted-order":
      return <NostrEncryptedOrderScenario />;
    case "nostr-direct-payment":
      return <NostrDirectPaymentScenario />;
    case "nostr-escrow":
      return <NostrEscrowScenario />;
    case "nostr-proof-of-payment":
      return <NostrProofOfPaymentScenario />;
    case "nostr-reviews":
      return <NostrReviewsScenario />;
    case "nostr-qa":
      return <NostrQAScenario />;
    case "nostr-report":
      return <NostrReportScenario />;
    case "nostr-zaps":
      return <NostrZapsScenario />;
    case "nostr-prisms":
      return <NostrPrismsScenario />;
    case "nostr-subscriptions":
      return <NostrSubscriptionsScenario />;
    case "nostr-cart":
      return <NostrCartScenario />;
    case "nostr-platform-fees":
      return <NostrPlatformFeesScenario />;
    case "nostr-zapvertising":
      return <NostrZapvertisingScenario />;
    case "nostr-fiat":
      return <NostrFiatScenario />;
    case "nostr-l402":
      return <NostrL402Scenario />;
    case "nostr-notifications":
      return <NostrNotificationsScenario />;
    case "nostr-disputes":
      return <NostrDisputesScenario />;
    default:
      return null;
  }
}
