/** Cliente fino de e-mail transacional (Fase 1.4d item 1). O usuário ainda não
 * tem conta em nenhum provedor (docs/PLANO-EXECUCAO.md secção 1.4) — assume-se
 * a API da Resend (REST simples, from/to/subject/html) por ser a mais comum
 * para este tipo de envio; RESEND_API_KEY fica vazia até lá e qualquer
 * chamada real falha com erro claro em vez de simular sucesso, igual ao
 * padrão já usado em paysuite.server.ts. */

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "CV Flexível <onboarding@resend.dev>";
  return { apiKey, from };
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { apiKey, from } = getConfig();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY não configurada. O envio de e-mails está pronto mas aguarda a conta/credenciais do usuário (docs/PLANO-EXECUCAO.md secção 1.4).",
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: [params.to], subject: params.subject, html: params.html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${body}`);
  }
}
