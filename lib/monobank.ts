import crypto from "crypto";
const MONOBANK_API_TOKEN = process.env.MONOBANK_API_TOKEN || "";
const APP_BASE_URL = process.env.APP_BASE_URL 
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

// The percentage the payment gateway takes (e.g. 1.3% = 0.013).
// We pass this fee to the customer so the merchant receives the exact net amount.
export const PLATA_FEE_PERCENT = process.env.PLATA_FEE_PERCENT 
  ? parseFloat(process.env.PLATA_FEE_PERCENT) 
  : 0.013;

/**
 * Calculates the gross amount to charge the user so that after the gateway fee,
 * the merchant is left with exactly `netAmount`.
 * Formula: Gross = Net / (1 - Fee)
 */
export function calculateAmountWithFee(netAmount: number): number {
  return Math.ceil(netAmount / (1 - PLATA_FEE_PERCENT));
}

interface MonobankInvoiceOptions {
  amount: number; // in pennies/kopecks (e.g. 10 UAH = 1000)
  reference: string;
  destination: string;
  redirectPath?: string;
}

interface MonobankInvoiceResponse {
  invoiceId: string;
  pageUrl: string;
}

export async function createMonobankInvoice(
  options: MonobankInvoiceOptions
): Promise<MonobankInvoiceResponse> {
  if (!MONOBANK_API_TOKEN) {
    throw new Error("MONOBANK_API_TOKEN is not configured.");
  }

  const payload = {
    amount: options.amount,
    ccy: 980, // UAH
    merchantPaymInfo: {
      reference: options.reference,
      destination: options.destination,
    },
    redirectUrl: `${APP_BASE_URL}${options.redirectPath || "/profile"}`,
    webHookUrl: `${APP_BASE_URL}/api/plata/callback`,
    validity: 3600 * 24, // 24 hours
  };

  const response = await fetch("https://api.monobank.ua/api/merchant/invoice/create", {
    method: "POST",
    headers: {
      "X-Token": MONOBANK_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Monobank create invoice failed:", response.status, errorData);
    throw new Error(`Failed to create Monobank invoice: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    invoiceId: data.invoiceId,
    pageUrl: data.pageUrl,
  };
}

let cachedMonobankPubKey: string | null = null;

async function getMonobankPublicKey(): Promise<string> {
  if (cachedMonobankPubKey) return cachedMonobankPubKey;

  const response = await fetch("https://api.monobank.ua/api/merchant/pubkey", {
    headers: { "X-Token": MONOBANK_API_TOKEN },
    next: { revalidate: 3600 } // cache for 1 hour
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Monobank public key");
  }

  const data = await response.json();
  cachedMonobankPubKey = data.key;
  return data.key;
}

/**
 * Parses and validates the webhook signature from Monobank.
 */
export async function verifyMonobankWebhook(
  signature: string,
  rawBody: Buffer | string
): Promise<boolean> {
  if (!signature) return false;

  try {
    const pubKeyBase64 = await getMonobankPublicKey();
    
    // The key from Monobank API is a base64 encoded PEM string.
    const pemKey = Buffer.from(pubKeyBase64, 'base64').toString('utf-8');

    const verify = crypto.createVerify("SHA256");
    verify.update(rawBody);
    
    return verify.verify(pemKey, signature, "base64");
  } catch (error) {
    console.error("Monobank webhook verification failed:", error);
    return false;
  }
}
