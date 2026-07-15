"use client";

import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/CartContext";
import { CheckIcon, PlusIcon } from "@/components/Icons";
import { formatBRL, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  function handleAdd() {
    add(product.sku);
    setJustAdded(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setJustAdded(false), 1600);
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-border-subtle bg-surface-card p-5 transition-shadow hover:shadow-md">
      <span aria-hidden="true" className="text-3xl leading-none">
        {product.emoji}
      </span>

      <h3 className="mt-3 text-base font-semibold text-text-strong">{product.name}</h3>
      {/* flex-1 empurra preço e botão para a base: descrições de 1 ou 2 linhas
          não desalinham os cards da mesma fileira. */}
      <p className="mt-1 flex-1 text-sm leading-relaxed text-text-muted">{product.description}</p>

      <div className="mt-4 flex items-center justify-between gap-3 pt-1">
        <span className="tabular text-lg font-bold text-text-strong">
          {formatBRL(product.priceCents)}
        </span>

        <button
          type="button"
          onClick={handleAdd}
          className={`inline-flex h-11 min-w-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card ${
            justAdded
              ? "bg-lc-purple-600 text-white focus-visible:ring-lc-purple-600"
              : "bg-lc-amber-500 text-lc-ink hover:bg-lc-amber-400 focus-visible:ring-lc-amber-500"
          }`}
        >
          {justAdded ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          {justAdded ? "Adicionado" : "Adicionar"}
          <span className="sr-only"> {product.name} ao carrinho</span>
        </button>
      </div>

      {/* Confirma a ação para quem usa leitor de tela, sem roubar o foco. */}
      <span aria-live="polite" className="sr-only">
        {justAdded ? `${product.name} adicionado ao carrinho.` : ""}
      </span>
    </article>
  );
}
