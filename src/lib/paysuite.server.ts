import { createHmac, timingSafeEqual } from "node:crypto";

/** Cliente fino sobre a API da PaySuite (paysuite.tech/docs, consultada em
 * 10/07/2026) — agregador único de M-Pesa, e-Mola, mKesh e cartão para
 * Moçambique (Stripe fica parqueado, ver docs/PLANO-EXECUCAO.md secção 1.2).
 * Credenciais ainda não fornecidas pelo usuário: as env vars ficam vazias até
 * lá, e qualquer chamada real falha com erro claro em vez de simular sucesso. */

export type PaySuiteMethod = "credit_card" | "mpesa" | "emola";

export interface PaySuitePayment {
  id: string;
  amount: number;
  reference: string;
  status: "pending" | "paid" | "completed" | "failed";
  checkout_url?: string;
  transaction?: {
    id: string;
    method: string;
    paid_at: string | null;
    status: string;
    transaction_id: string;
  };
}

function getConfig() {
  const apiKey = process.env.PAYSUITE_API_KEY;
  const baseUrl = process.env.PAYSUITE_BASE_URL || "https://paysuite.tech/api/v1";
  const webhookSecret = process.env.PAYSUITE_WEBHOOK_SECRET;
  return { apiKey, baseUrl, webhookSecret };
}

async function paysuiteFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = getConfig();
  if (!apiKey) {
    throw new Error(
      "PAYSUITE_API_KEY não configurada. A integração PaySuite está pronta mas aguarda as credenciais reais do usuário.",
    );
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && String(body.message)) ||
      `PaySuite respondeu ${res.status}`;
    throw new Error(message);
  }
  return (body as { data: T }).data;
}

export async function createPaymentRequest(params: {
  amount: number;
  reference: string;
  method?: PaySuiteMethod;
  description?: string;
  returnUrl: string;
  callbackUrl: string;
}): Promise<PaySuitePayment> {
  return paysuiteFetch<PaySuitePayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amount,
      reference: params.reference,
      method: params.method,
      description: params.description,
      return_url: params.returnUrl,
      callback_url: params.callbackUrl,
    }),
  });
}

export async function getPaymentStatus(paymentId: string): Promise<PaySuitePayment> {
  return paysuiteFetch<PaySuitePayment>(`/payments/${paymentId}`, { method: "GET" });
}

/** Valida a assinatura do webhook (header X-Webhook-Signature, HMAC-SHA256 do
 * corpo bruto com PAYSUITE_WEBHOOK_SECRET). Recebe o corpo como texto — nunca
 * validar sobre o JSON já reserializado, a assinatura é sobre os bytes exatos
 * recebidos. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const { webhookSecret } = getConfig();
  if (!webhookSecret || !signatureHeader) return false;

  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
