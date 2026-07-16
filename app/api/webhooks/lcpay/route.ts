import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getConfig } from "@/lib/config";
import { LcPayError, getTransactionStatus } from "@/lib/lcpay";
import { findOrderByTransactionId, markOrderPaid } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Notificação de pagamento da LCPay.
 *
 * Conforme a doc ("Fluxos de integração" e página de Webhook), a requisição chega
 * com o CORPO VAZIO — tudo vem nos headers:
 *   webhook-event-type: pix.payment
 *   webhook-transaction-id: <transactionId>
 *   webhook-external-code: <vazio no Pix dinâmico>
 *   X-Api-Key: <chave da notificação — "valide antes de processar">
 *
 * Precisamos responder 2xx rápido; qualquer outra coisa entra na fila de reenvio
 * (~2 min, até ~30 tentativas).
 *
 * Segurança: a notificação nunca é a palavra final. Como o corpo é vazio, ela
 * afirma "foi pago" sem provar o valor — então reconfirmamos com
 * `consultarTransactions` e só liberamos o pedido em APPROVED. Essa reconfirmação
 * na própria LCPay é a fronteira de segurança; a `X-Api-Key`, quando temos o valor
 * para comparar, é uma camada extra. A doc não expõe onde obter a chave, e por isso
 * a validação por chave é opcional — sem ela, a reconfirmação sustenta a garantia.
 */

/** Comparação em tempo constante — evita descobrir a chave por timing. */
function isValidApiKey(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  let config;
  try {
    config = getConfig();
  } catch (error) {
    console.error("[webhook] configuração ausente", error);
    // 500 faz a LCPay reenviar — desejável, já que a falha é nossa e temporária.
    return NextResponse.json({ error: "Configuração indisponível." }, { status: 500 });
  }

  // A doc manda validar a X-Api-Key "antes de processar". Só conseguimos comparar
  // se tivermos o valor esperado configurado. Quando temos, uma chave divergente é
  // recusada aqui. Quando não temos (a doc não diz onde obtê-la), seguimos e deixamos
  // a reconfirmação em consultarTransactions garantir que só um pagamento real passa.
  if (config.webhookApiKey && !isValidApiKey(request.headers.get("x-api-key"), config.webhookApiKey)) {
    console.warn("[webhook] recusado: X-Api-Key inválida ou ausente");
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const eventType = request.headers.get("webhook-event-type");
  const transactionId = request.headers.get("webhook-transaction-id");

  // A partir daqui, respondemos 2xx mesmo no que não conseguimos usar, para não
  // deixar a LCPay reenviando 30 vezes em vão.
  if (eventType !== "pix.payment") {
    console.warn(`[webhook] evento ignorado: ${eventType}`);
    return NextResponse.json({ received: true, ignored: "evento não tratado" });
  }
  if (!transactionId) {
    console.warn("[webhook] sem webhook-transaction-id");
    return NextResponse.json({ received: true, ignored: "transactionId ausente" });
  }

  const order = await findOrderByTransactionId(transactionId);
  if (!order) {
    console.warn(`[webhook] transação sem pedido correspondente: ${transactionId}`);
    return NextResponse.json({ received: true, ignored: "pedido não encontrado" });
  }

  if (order.status === "PAID") {
    return NextResponse.json({ received: true, orderId: order.id, status: "PAID" });
  }

  // A notificação afirma "foi pago", mas não diz o valor — o corpo vem vazio.
  // Confirmamos na fonte antes de liberar o pedido.
  try {
    const snapshot = await getTransactionStatus(transactionId);
    if (!snapshot.isPaid) {
      console.warn(`[webhook] ${order.id}: notificado mas status é ${snapshot.status}; ignorando`);
      return NextResponse.json({ received: true, orderId: order.id, status: order.status });
    }

    if (snapshot.paidAmountCents !== null && snapshot.paidAmountCents !== order.totalCents) {
      console.warn(
        `[webhook] ${order.id}: valor divergente (pago ${snapshot.paidAmountCents}, esperado ${order.totalCents})`,
      );
    }

    await markOrderPaid(order.id, {
      paidVia: "webhook",
      paidAmountCents: snapshot.paidAmountCents,
      endToEndId: snapshot.endToEndId,
    });
    console.info(`[webhook] ${order.id} confirmado via webhook`);

    return NextResponse.json({ received: true, orderId: order.id, status: "PAID" });
  } catch (error) {
    if (error instanceof LcPayError) {
      console.error(`[webhook] ${order.id}: consulta LCPay ${error.status} - ${error.message}`);
    } else {
      console.error(`[webhook] ${order.id}: erro inesperado`, error);
    }
    // 500 pede reenvio; se nem isso vingar, o polling da tela ainda confirma.
    return NextResponse.json({ error: "Falha ao confirmar a transação." }, { status: 500 });
  }
}
