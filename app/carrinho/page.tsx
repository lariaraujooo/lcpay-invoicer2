import type { Metadata } from "next";

import { CartView } from "@/components/CartView";

export const metadata: Metadata = { title: "Carrinho — LC Culture Store" };

export default function CarrinhoPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight text-text-strong sm:text-3xl">
        Seu carrinho
      </h1>
      <p className="mt-2 text-sm text-text-body">
        Revise os itens e finalize o pedido para gerar a cobrança Pix.
      </p>
      <div className="mt-8">
        <CartView />
      </div>
    </div>
  );
}
