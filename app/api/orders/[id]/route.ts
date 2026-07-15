import { NextResponse } from "next/server";

import { LcPayError, getTransactionStatus } from "@/lib/lcpay";
import { getOrder, markOrderPaid, type Order } from "@/lib/store";

export const runtime = "nodejs";

/** Só devolve ao browser o que a tela precisa. */
function serialize(order: Order) {
  return {
    id: order.id,
    items: order.items,
    totalCents: order.totalCents,
    status: order.status,
    textContent: order.textContent,
    qrImageBase64: order.qrImageBase64,
    paidVia: order.paidVia,
    paidAmountCents: order.paidAmountCents,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

/**
 * Status do pedido — é o que a tela do QR Code consulta a cada poucos segundos.
 *
 * Enquanto o pedido está PENDING, funciona como o fallback documentado do webhook:
 * consulta `consultarTransactions` na LCPay e considera pago apenas em APPROVED.
 * Já confirmado, responde do armazenamento local e não chama a LCPay à toa.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (order.status !== "PENDING" || !order.transactionId) {
    return NextResponse.json({ order: serialize(order) });
  }

  try {
    const snapshot = await getTransactionStatus(order.transactionId);
    if (snapshot.isPaid) {
      const paid = await markOrderPaid(order.id, {
        paidVia: "polling",
        paidAmountCents: snapshot.paidAmountCents,
        endToEndId: snapshot.endToEndId,
      });
      return NextResponse.json({ order: serialize(paid ?? order) });
    }
    return NextResponse.json({ order: serialize(order), transactionStatus: snapshot.status });
  } catch (error) {
    // Uma consulta que falha não invalida o pedido: o QR continua pagável e a
    // próxima tentativa (ou o webhook) confirma. Devolvemos o estado atual.
    if (error instanceof LcPayError) {
      console.error(`[orders] ${order.id}: consulta LCPay ${error.status} - ${error.message}`);
    } else {
      console.error(`[orders] ${order.id}: erro inesperado na consulta`, error);
    }
    return NextResponse.json({ order: serialize(order), pollError: true });
  }
}
