const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API_BASE_URL = "https://analyticsdata.googleapis.com/v1beta";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type AnalyticsReportResponse = {
  rows?: Array<{
    metricValues?: Array<{ value?: string }>;
  }>;
  totals?: Array<{
    metricValues?: Array<{ value?: string }>;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export type GoogleAnalyticsSummary = {
  configured: boolean;
  onlineNow: number;
  views: number;
  missing?: string[];
};

export class GoogleAnalyticsDataError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "GoogleAnalyticsDataError";
    this.code = code;
    this.status = status;
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

type AnalyticsConfig =
  | {
      configured: true;
      propertyId: string;
      clientEmail: string;
      privateKey: string;
    }
  | {
      configured: false;
      missing: string[];
    };

function getAnalyticsConfig(): AnalyticsConfig {
  const propertyId = process.env.GA_PROPERTY_ID;
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL ?? process.env.GA_CLIENT_EMAIL;
  const privateKey = (
    process.env.GOOGLE_PRIVATE_KEY ?? process.env.GA_PRIVATE_KEY ?? ""
  ).replace(/\\n/g, "\n");

  const missing = [
    !propertyId ? "GA_PROPERTY_ID" : null,
    !clientEmail ? "GOOGLE_CLIENT_EMAIL" : null,
    !privateKey ? "GOOGLE_PRIVATE_KEY" : null,
  ].filter((key): key is string => key !== null);

  if (missing.length > 0) return { configured: false, missing };
  return {
    configured: true,
    propertyId: propertyId as string,
    clientEmail: clientEmail as string,
    privateKey,
  };
}

function base64UrlEncode(input: string | ArrayBuffer) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function privateKeyToArrayBuffer(privateKey: string) {
  const base64Key = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  if (!base64Key) {
    throw new GoogleAnalyticsDataError(
      "ga_private_key_invalid",
      "GOOGLE_PRIVATE_KEY is empty or not a valid private key.",
      500,
    );
  }

  const binary = atob(base64Key);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function createSignedJwt(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: ANALYTICS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload),
  )}`;

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyToArrayBuffer(privateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new GoogleAnalyticsDataError(
      "ga_private_key_invalid",
      "GOOGLE_PRIVATE_KEY could not be parsed. Re-copy the private_key from the service account JSON.",
      500,
    );
  }

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function getAccessToken(clientEmail: string, privateKey: string) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const assertion = await createSignedJwt(clientEmail, privateKey);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new GoogleAnalyticsDataError(
      "ga_auth_failed",
      payload.error_description ?? payload.error ?? "Google rejected the service account credentials.",
      502,
    );
  }

  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return payload.access_token;
}

function getMetricValue(report: AnalyticsReportResponse) {
  const value =
    report.totals?.[0]?.metricValues?.[0]?.value ??
    report.rows?.[0]?.metricValues?.[0]?.value ??
    "0";

  return Number.parseInt(value, 10) || 0;
}

async function postAnalyticsReport(
  path: string,
  token: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as AnalyticsReportResponse;

  if (!response.ok) {
    const message = payload.error?.message ?? `GA4 report failed with status ${response.status}.`;
    const code =
      response.status === 403
        ? "ga_property_forbidden"
        : response.status === 404
          ? "ga_property_not_found"
          : response.status === 400
            ? "ga_report_invalid"
            : "ga_report_failed";

    throw new GoogleAnalyticsDataError(code, message, response.status);
  }

  return payload;
}

export async function getGoogleAnalyticsSummary(): Promise<GoogleAnalyticsSummary> {
  const config = getAnalyticsConfig();
  if (!config.configured) {
    return {
      configured: false,
      onlineNow: 0,
      views: 0,
      missing: config.missing,
    };
  }

  const token = await getAccessToken(config.clientEmail, config.privateKey);
  const property = `properties/${config.propertyId}`;
  const today = new Date().toISOString().slice(0, 10);

  const [realtimeReport, viewsReport] = await Promise.all([
    postAnalyticsReport(`${property}:runRealtimeReport`, token, {
      metrics: [{ name: "activeUsers" }],
      metricAggregations: ["TOTAL"],
    }),
    postAnalyticsReport(`${property}:runReport`, token, {
      dateRanges: [{ startDate: "2020-01-01", endDate: today }],
      metrics: [{ name: "screenPageViews" }],
      metricAggregations: ["TOTAL"],
    }),
  ]);

  return {
    configured: true,
    onlineNow: getMetricValue(realtimeReport),
    views: getMetricValue(viewsReport),
  };
}
