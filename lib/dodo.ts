import { Webhook } from "standardwebhooks";

type DodoCheckoutResponse = {
  checkout_url?: string;
  checkoutUrl?: string;
  session_id?: string;
  payment_link?: string;
  paymentLink?: string;
  url?: string;
  checkout_session_id?: string;
  checkoutSessionId?: string;
  id?: string;
};

export type DodoWebhookEvent = {
  type?: string;
  event_type?: string;
  data?: Record<string, unknown>;
};

const DODO_BASE_URLS = {
  test: "https://test.dodopayments.com",
  live: "https://live.dodopayments.com",
} as const;

function getDodoBaseUrl() {
  const environment = process.env.DODO_ENVIRONMENT?.trim();
  if (environment !== "test" && environment !== "live") {
    throw new Error("DODO_ENVIRONMENT must be set to test or live.");
  }

  return DODO_BASE_URLS[environment];
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getDodoWebhookSecret() {
  return getRequiredEnv("DODO_WEBHOOK_SECRET");
}

export async function createDodoCheckout({
  orderId,
  buildingType,
  companyName,
  domain,
  priceCents,
  returnUrl,
  cancelUrl,
}: {
  orderId: string;
  buildingType: string;
  companyName: string;
  domain: string;
  priceCents: number;
  returnUrl: string;
  cancelUrl: string;
}) {
  const apiKey = getRequiredEnv("DODO_API_KEY");
  const productId = getRequiredEnv("DODO_PRODUCT_ID");
  const response = await fetch(`${getDodoBaseUrl()}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
          amount: priceCents,
        },
      ],
      return_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        building_order_id: orderId,
        building_type: buildingType,
        company_name: companyName,
        domain,
      },
    }),
  });
  const rawBody = await response.text();
  let payload: DodoCheckoutResponse | { error?: unknown } = {};

  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    console.error("Dodo checkout creation failed", {
      status: response.status,
      body: rawBody.slice(0, 700),
    });
    throw new Error("Could not start Dodo checkout right now.");
  }

  const checkoutUrl =
    "checkout_url" in payload && payload.checkout_url
      ? payload.checkout_url
      : "checkoutUrl" in payload && payload.checkoutUrl
        ? payload.checkoutUrl
        : "payment_link" in payload && payload.payment_link
          ? payload.payment_link
          : "paymentLink" in payload && payload.paymentLink
            ? payload.paymentLink
            : "url" in payload && payload.url
              ? payload.url
              : null;
  const checkoutId =
    "session_id" in payload && payload.session_id
      ? payload.session_id
      : "checkout_session_id" in payload && payload.checkout_session_id
      ? payload.checkout_session_id
      : "checkoutSessionId" in payload && payload.checkoutSessionId
        ? payload.checkoutSessionId
        : "id" in payload && payload.id
          ? payload.id
          : null;

  if (!checkoutUrl) {
    console.error("Dodo checkout response did not include a URL", payload);
    throw new Error("Dodo did not return a checkout URL.");
  }

  return { checkoutUrl, checkoutId };
}

export function verifyDodoWebhook(payload: string, headers: Headers) {
  const webhook = new Webhook(getDodoWebhookSecret());
  const event = webhook.verify(payload, {
    "webhook-id": headers.get("webhook-id") ?? "",
    "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
    "webhook-signature": headers.get("webhook-signature") ?? "",
  });

  return event as DodoWebhookEvent;
}

export function isDodoPaymentSucceeded(event: DodoWebhookEvent) {
  return (event.type ?? event.event_type) === "payment.succeeded";
}

export function getDodoPaymentId(event: DodoWebhookEvent) {
  const data = event.data ?? {};
  const paymentId = data.payment_id ?? data.paymentId ?? data.id;

  return typeof paymentId === "string" ? paymentId : null;
}

export function getDodoCheckoutId(event: DodoWebhookEvent) {
  const data = event.data ?? {};
  const checkoutId =
    data.checkout_session_id ??
    data.checkoutSessionId ??
    data.checkout_id ??
    data.checkoutId;

  return typeof checkoutId === "string" ? checkoutId : null;
}

export function getDodoOrderId(event: DodoWebhookEvent) {
  const data = event.data ?? {};
  const metadata = data.metadata;

  if (metadata && typeof metadata === "object" && "building_order_id" in metadata) {
    const orderId = metadata.building_order_id;
    return typeof orderId === "string" ? orderId : null;
  }

  return null;
}
