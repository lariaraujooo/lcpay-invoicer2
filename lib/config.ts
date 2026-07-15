import "server-only";

/**
 * Configuração da integração LCPay.
 *
 * Estas credenciais dão acesso à conta de pagamentos e por isso vivem apenas no
 * servidor — nenhuma delas pode virar `NEXT_PUBLIC_*`.
 */

export type LcPayConfig = {
  baseUrl: string;
  accountId: string;
  token: string;
  webhookApiKey: string;
  /** URL HTTPS pública desta aplicação. Ausente = webhook desligado (só polling). */
  publicBaseUrl: string | null;
  isProduction: boolean;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Copie .env.example para .env.local e preencha as credenciais do painel LC Pay.`,
    );
  }
  return value;
}

/**
 * A doc da LCPay só dispara webhook quando `urlCallBackIntegrador` é enviado, e a
 * URL precisa ser HTTPS e acessível publicamente. Em localhost não há como a LCPay
 * nos alcançar, então preferimos omitir o campo a mandar uma URL inalcançável —
 * a confirmação fica com o polling até existir um túnel/deploy.
 */
function readPublicBaseUrl(): string | null {
  const raw = process.env.PUBLIC_BASE_URL?.trim();

  if (raw) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`PUBLIC_BASE_URL não é uma URL válida: ${raw}`);
    }
    if (parsed.protocol !== "https:") {
      throw new Error(
        `PUBLIC_BASE_URL precisa ser HTTPS para o webhook da LCPay funcionar (recebido: ${parsed.protocol}//). Remova a variável para usar apenas polling.`,
      );
    }
    return parsed.origin;
  }

  // Na Vercel a app já tem URL pública HTTPS: o webhook funciona sem configurar nada.
  // Em produção usamos o domínio estável; em preview, a URL própria do deploy.
  const vercelHost =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  if (vercelHost?.trim()) return `https://${vercelHost.trim()}`;

  return null;
}

let cached: LcPayConfig | null = null;

export function getConfig(): LcPayConfig {
  if (cached) return cached;

  const baseUrl = (process.env.LCPAY_BASE_URL?.trim() || "https://api.lcpay.com.br").replace(/\/+$/, "");

  cached = {
    baseUrl,
    accountId: required("LCPAY_ACCOUNT_ID"),
    token: required("LCPAY_TOKEN"),
    webhookApiKey: required("LCPAY_WEBHOOK_API_KEY"),
    publicBaseUrl: readPublicBaseUrl(),
    isProduction: !baseUrl.includes("-hml"),
  };
  return cached;
}

/** Roda em serverless (Vercel), onde o filesystem é somente-leitura. */
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL);
}

/** Diagnóstico para a UI. Nunca expõe valores de credencial — apenas se estão presentes. */
export function getEnvironmentInfo() {
  try {
    const config = getConfig();
    return {
      configured: true as const,
      isProduction: config.isProduction,
      webhookEnabled: config.publicBaseUrl !== null,
    };
  } catch {
    return { configured: false as const, isProduction: true, webhookEnabled: false };
  }
}
