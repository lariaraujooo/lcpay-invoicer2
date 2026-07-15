import { connection } from "next/server";

import { getEnvironmentInfo, isServerless } from "@/lib/config";
import { isUsingRedis } from "@/lib/store";
import { AlertIcon } from "@/components/Icons";

/**
 * Deixa explícito que isto é uma demo interna — e, em produção, que o dinheiro é real.
 * A doc alerta que Pix criado em `api.lcpay.com.br` é cobrança de verdade.
 */
export async function DemoBanner() {
  // Sem isto o banner seria renderizado no build e congelaria o estado das
  // credenciais no HTML — continuaria dizendo "não configuradas" depois do setup.
  await connection();

  const { configured, isProduction, webhookEnabled } = getEnvironmentInfo();
  // Em serverless o armazenamento em arquivo não funciona: sem Redis, os pedidos
  // se perdem entre invocações e nada é conciliado.
  const storageBroken = isServerless() && !isUsingRedis();

  return (
    <>
      <div className="border-b border-lc-purple-700 bg-lc-purple-700 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs sm:px-6">
          <span className="inline-flex items-center gap-1.5 font-semibold tracking-wide uppercase">
            <AlertIcon className="h-3.5 w-3.5" />
            Ambiente de demonstração interna
          </span>
          <span className="text-lc-purple-100">
            {!configured
              ? "Credenciais da LC Pay não configuradas — defina as variáveis de ambiente."
              : isProduction
                ? "Conectado à produção da LC Pay: os pagamentos Pix são reais e o valor é debitado de verdade."
                : "Conectado ao ambiente de homologação da LC Pay: os pagamentos não são reais."}
            {configured && webhookEnabled && " Webhook ativo."}
          </span>
        </div>
      </div>

      {storageBroken && (
        <div className="border-b border-red-700 bg-red-700 text-white">
          <div className="mx-auto max-w-6xl px-4 py-2 text-xs sm:px-6">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <AlertIcon className="h-3.5 w-3.5" />
              Armazenamento não configurado
            </span>{" "}
            <span className="text-red-100">
              Sem Redis em ambiente serverless os pedidos não persistem. Conecte o Upstash em
              Storage, no painel da Vercel.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
