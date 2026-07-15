import "server-only";

import { getConfig } from "./config";

/**
 * Cliente da API LCPay — https://doc-api.lcpay.com.br
 *
 * Endpoints usados (paths conforme o OpenAPI oficial):
 *   POST /api/v2/movimentacao/{accountId}/pixCashIn                       (criar Pix dinâmico)
 *   GET  /api/accounts/{accountId}/consultarTransactions/{transactionId}  (consultar status)
 *
 * Atenção: a página "URLs Produção e Homologação" da doc grafa o path como
 * `pixCashin`, mas o OpenAPI e a página do próprio endpoint usam `pixCashIn`
 * (I maiúsculo). Seguimos o OpenAPI.
 */

const REQUEST_TIMEOUT_MS = 20_000;

/** Status possíveis em `transactionStatus`. Pago é só APPROVED. */
export type TransactionStatus =
  | "CREATED"
  | "APPROVED"
  | "REJECTED"
  | "OPEN"
  | "CANCELED"
  | "PARTIAL"
  | "UNFINISHED";

export type PixCharge = {
  transactionId: string;
  /** Copia-e-cola (payload EMV). */
  textContent: string | null;
  /** PNG do QR Code em base64. */
  qrImageBase64: string | null;
  qrCodeUrl: string | null;
};

export type TransactionSnapshot = {
  transactionId: string;
  status: TransactionStatus | string;
  isPaid: boolean;
  paidAmountCents: number | null;
  endToEndId: string | null;
  transactionDate: string | null;
};

/** Erro da API. `status` 0 = falha de rede/timeout (transitório). */
export class LcPayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "LcPayError";
  }

  /** 5xx e falhas de rede são transitórios; 4xx é erro nosso na requisição. */
  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

function reaisToCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Extrai a mensagem do formato de erro da doc: `{ error: { code, msg } }`. */
function parseApiError(status: number, body: string): LcPayError {
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string; msg?: string } };
    const message = parsed?.error?.msg;
    if (message) return new LcPayError(message, status, parsed.error?.code);
  } catch {
    // corpo não-JSON (ex.: HTML de proxy) — cai no genérico abaixo
  }

  const fallback: Record<number, string> = {
    401: "Token inválido ou expirado.",
    403: "Sem permissão sobre a conta informada.",
    404: "Recurso não encontrado.",
    422: "Dados da cobrança recusados pela LCPay.",
  };
  return new LcPayError(fallback[status] ?? `Erro HTTP ${status} na LCPay.`, status);
}

async function request(pathname: string, init: RequestInit): Promise<unknown> {
  const { baseUrl, token } = getConfig();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "Tempo esgotado" : "Falha de conexão";
    throw new LcPayError(`${reason} ao contatar a LCPay.`, 0);
  }

  const body = await response.text();
  if (!response.ok) throw parseApiError(response.status, body);

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new LcPayError("Resposta da LCPay não é um JSON válido.", response.status);
  }
}

/**
 * Cria uma intenção de pagamento Pix dinâmico (imediato).
 *
 * A doc avisa que este endpoint NÃO aplica Bean Validation e que valores inválidos
 * tendem a virar 500 — por isso validamos o payload aqui antes de enviar.
 *
 * `urlCallBackIntegrador` só é enviado quando temos URL pública HTTPS *e* a chave
 * para validar a notificação; omiti-lo é o jeito documentado de dizer "não quero
 * webhook" (aí a conciliação fica com o polling).
 */
export async function createPixCharge(input: {
  amountCents: number;
  orderId: string;
  description: string;
}): Promise<PixCharge> {
  const { accountId, webhookUrl } = getConfig();

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new LcPayError("Valor da cobrança precisa ser maior que zero.", 422);
  }
  if (!input.orderId.trim()) {
    throw new LcPayError("Número do pedido é obrigatório.", 422);
  }

  const payload: Record<string, unknown> = {
    valorTotal: input.amountCents / 100,
    numeroPedido: input.orderId,
    conteudo: input.description,
  };
  if (webhookUrl) {
    payload.urlCallBackIntegrador = webhookUrl;
  }

  const response = (await request(`/api/v2/movimentacao/${encodeURIComponent(accountId)}/pixCashIn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as {
    data?: {
      transactionId?: string;
      instantPayment?: {
        textContent?: string;
        qrcodeURL?: string;
        generateImage?: { imageContent?: string };
      };
    };
  };

  const transactionId = response?.data?.transactionId;
  if (!transactionId) {
    throw new LcPayError("A LCPay não devolveu o transactionId da cobrança.", 502);
  }

  const instantPayment = response.data?.instantPayment;
  return {
    transactionId,
    textContent: instantPayment?.textContent ?? null,
    qrImageBase64: instantPayment?.generateImage?.imageContent ?? null,
    qrCodeUrl: instantPayment?.qrcodeURL ?? null,
  };
}

/** Consulta o status atual de uma transação. Fallback quando o webhook não chega. */
export async function getTransactionStatus(transactionId: string): Promise<TransactionSnapshot> {
  const { accountId } = getConfig();

  const response = (await request(
    `/api/accounts/${encodeURIComponent(accountId)}/consultarTransactions/${encodeURIComponent(transactionId)}`,
    { method: "GET" },
  )) as {
    data?: {
      transactions?: Array<{
        transactionId?: string;
        transactionStatus?: string;
        paidAmount?: number;
        endToEndId?: string;
        transactionDate?: string;
      }>;
    };
  };

  const transaction = response?.data?.transactions?.[0];
  if (!transaction?.transactionStatus) {
    throw new LcPayError("Transação não encontrada na LCPay.", 404);
  }

  return {
    transactionId: transaction.transactionId ?? transactionId,
    status: transaction.transactionStatus,
    isPaid: transaction.transactionStatus === "APPROVED",
    paidAmountCents: reaisToCents(transaction.paidAmount),
    endToEndId: transaction.endToEndId ?? null,
    transactionDate: transaction.transactionDate ?? null,
  };
}
