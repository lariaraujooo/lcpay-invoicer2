"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/CartContext";
import { CartIcon, LcMark } from "@/components/Icons";

export function Header() {
  const { itemCount, isHydrated } = useCart();
  const pathname = usePathname();
  const isCart = pathname === "/carrinho";

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface-card/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
        >
          <LcMark className="h-9 w-9 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold text-text-strong">LC Culture Store</span>
            <span className="text-[11px] font-medium tracking-wide text-text-muted">
              Pagamentos via LC Pay
            </span>
          </span>
        </Link>

        <Link
          href="/carrinho"
          aria-label={`Carrinho${itemCount > 0 ? `, ${itemCount} ${itemCount === 1 ? "item" : "itens"}` : " vazio"}`}
          aria-current={isCart ? "page" : undefined}
          className={`relative inline-flex h-11 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card ${
            isCart
              ? "border-lc-amber-500 bg-lc-amber-50 text-lc-amber-900 dark:bg-lc-amber-500/10 dark:text-lc-amber-300"
              : "border-border-subtle text-text-body hover:bg-surface-muted"
          }`}
        >
          <CartIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Carrinho</span>
          {isHydrated && itemCount > 0 && (
            <span className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lc-purple-600 px-1.5 text-[11px] font-bold text-white">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
