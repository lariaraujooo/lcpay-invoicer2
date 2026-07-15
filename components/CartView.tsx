"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MAX_QTY_PER_ITEM, useCart } from "@/components/CartContext";
import {
  AlertIcon,
  ArrowLeftIcon,
  CartIcon,
  MinusIcon,
  PixIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/Icons";
import { formatBRL } from "@/lib/products";

export function CartView() {
  const { entries, totalCents, itemCount, isHydrated, setQty, remove } = useCart();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Só SKU e quantidade: o servidor recalcula o preço pelo catálogo.
        body: JSON.stringify({
          items: entries.map((entry) => ({ sku: entry.product.sku, qty: entry.qty })),
        }),
      });

      const payload = (await response.json()) as { orderId?: string; error?: string };
      if (!response.ok || !payload.orderId) {
        setError(payload.error ?? "Não foi possível gerar a cobrança Pix.");
        setIsSubmitting(false);
        return;
      }

      // O carrinho só é limpo na tela do pedido, depois que o QR aparece —
      // se a navegação falhar aqui, o usuário não perde a seleção.
      router.push(`/pedido/${payload.orderId}`);
    } catch {
      setError("Falha de conexão. Verifique sua rede e tente novamente.");
      setIsSubmitting(false);
    }
  }

  if (!isHydrated) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-border-subtle bg-surface-muted" />
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-subtle bg-surface-card px-6 py-14 text-center">
        <CartIcon className="mx-auto h-9 w-9 text-text-muted" />
        <h2 className="mt-4 text-base font-semibold text-text-strong">Seu carrinho está vazio</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-muted">
          Escolha itens na vitrine para montar seu pedido e testar o pagamento via Pix.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-lc-amber-500 px-4 text-sm font-semibold text-lc-ink transition-colors hover:bg-lc-amber-400 focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page focus-visible:outline-none"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Ver a vitrine
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <ul className="space-y-3">
        {entries.map(({ product, qty, subtotalCents }) => (
          <li
            key={product.sku}
            className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-card p-4"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {product.emoji}
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-text-strong">{product.name}</h3>
              <p className="tabular mt-0.5 text-xs text-text-muted">
                {formatBRL(product.priceCents)} cada
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border-subtle p-1">
              <button
                type="button"
                onClick={() => setQty(product.sku, qty - 1)}
                aria-label={`Diminuir quantidade de ${product.name}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-body transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:outline-none"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <span
                aria-label={`Quantidade de ${product.name}: ${qty}`}
                className="tabular w-7 text-center text-sm font-semibold text-text-strong"
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty(product.sku, qty + 1)}
                disabled={qty >= MAX_QTY_PER_ITEM}
                aria-label={`Aumentar quantidade de ${product.name}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-body transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <span className="tabular hidden w-20 text-right text-sm font-bold text-text-strong sm:block">
              {formatBRL(subtotalCents)}
            </span>

            <button
              type="button"
              onClick={() => remove(product.sku)}
              aria-label={`Remover ${product.name} do carrinho`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:hover:bg-red-500/10"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <aside className="rounded-xl border border-border-subtle bg-surface-card p-5 lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold text-text-strong">Resumo do pedido</h2>

        <dl className="mt-4 space-y-2 border-b border-border-subtle pb-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </dt>
            <dd className="tabular text-text-body">{formatBRL(totalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Forma de pagamento</dt>
            <dd className="text-text-body">Pix</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm font-medium text-text-body">Total</span>
          <span className="tabular text-2xl font-bold text-text-strong">
            {formatBRL(totalCents)}
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs leading-relaxed text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleCheckout}
          disabled={isSubmitting}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-lc-amber-500 px-4 text-sm font-semibold text-lc-ink transition-colors hover:bg-lc-amber-400 focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              Gerando cobrança…
            </>
          ) : (
            <>
              <PixIcon className="h-4 w-4" />
              Pagar com Pix
            </>
          )}
        </button>

        <Link
          href="/"
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:outline-none"
        >
          Continuar escolhendo
        </Link>
      </aside>
    </div>
  );
}
