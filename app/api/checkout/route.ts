import { NextResponse } from "next/server";

import { logCredentialDiagnostics } from "@/lib/config";
import { LcPayError, createPixCharge } from "@/lib/lcpay";
import { findProduct } from "@/lib/products";
import { attachCharge, createOrder, markOrderFailed, type Order, type OrderItem } from "@/lib/store";

export const runtime = "nodejs";

const MAX_QTY_PER_ITEM = 10;

type CheckoutRequest = { items?: Array<{ sku?: unknown; qty?: unknown }> };

/**
 * Cria o pedido e gera a cobrança Pix na LCPay.
 *
 * Recebe apenas SKU e quantidade: o preço e o total são recalculados a partir do
 * catálogo do servidor, para que um preço adulterado no cliente não vire cobrança.
 */
export async function POST(request: Request) {
  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "O carrinho está vazio." }, { status: 400 });
  }

  const items: OrderItem[] = [];
  for (const raw of body.items) {
    if (typeof raw?.sku !== "string") {
      return NextResponse.json({ error: "Item do carrinho inválido." }, { status: 400 });
    }

    const product = findProduct(raw.sku);
    if (!product) {
      return NextResponse.json({ error: `Produto desconhecido: ${raw.sku}` }, { status: 400 });
    }
    if (items.some((item) => item.sku === product.sku)) {
      return NextResponse.json({ error: `Produto repetido no carrinho: ${raw.sku}` }, { status: 400 });
    }

    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return NextResponse.json(
        { error: `Quantidade inválida para ${product.name} (1 a ${MAX_QTY_PER_ITEM}).` },
        { status: 400 },
      );
    }

    items.push({
      sku: product.sku,
      emoji: product.emoji,
      name: product.name,
      priceCents: product.priceCents,
      qty,
    });
  }

  const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  if (totalCents <= 0) {
    return NextResponse.json({ error: "Total do pedido precisa ser maior que zero." }, { status: 400 });
  }

  // Gravar o pedido pode falhar antes de qualquer contato com a LCPay — por exemplo
  // em serverless sem Redis, onde o backend de arquivo não consegue escrever.
  // Sem este catch a exceção escaparia e viraria um 500 de corpo vazio, que o
  // cliente não consegue distinguir de uma falha de rede.
  let order: Order;
  try {
    order = await createOrder(items, totalCents);
  } catch (error) {
    console.error("[checkout] falha ao registrar o pedido", error);
    return NextResponse.json(
      { error: "Não foi possível registrar o pedido: armazenamento indisponível." },
      { status: 503 },
    );
  }

  try {
    const charge = await createPixCharge({
      amountCents: order.totalCents,
      orderId: order.id,
      description: `LC Culture Store - Pedido ${order.id}`,
    });

    await attachCharge(order.id, charge);

    return NextResponse.json({ orderId: order.id }, { status: 201 });
  } catch (error) {
    await markOrderFailed(order.id);

    if (error instanceof LcPayError) {
      console.error(`[checkout] pedido ${order.id}: LCPay ${error.status} - ${error.message}`);
      // 4xx de autenticação/permissão quase sempre é credencial mal configurada.
      // O diagnóstico só vai para o log, e não expõe os valores.
      if ([400, 401, 403].includes(error.status)) logCredentialDiagnostics();
      return NextResponse.json(
        { error: error.isTransient ? "A LCPay está indisponível no momento. Tente novamente." : error.message },
        { status: error.isTransient ? 503 : 502 },
      );
    }

    console.error(`[checkout] pedido ${order.id}: erro inesperado`, error);
    return NextResponse.json({ error: "Não foi possível gerar a cobrança Pix." }, { status: 500 });
  }
}
