"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { findProduct, type Product } from "@/lib/products";

/**
 * Carrinho no cliente, guardado no localStorage.
 *
 * Guarda apenas SKU + quantidade — o preço exibido vem sempre do catálogo, e o
 * total cobrado é recalculado no servidor durante o checkout.
 *
 * É modelado como store externa (`useSyncExternalStore`) em vez de estado + efeito:
 * o React lê o snapshot do servidor (vazio) na hidratação e troca pelo real logo
 * depois, sem mismatch e sem render em cascata. De brinde, o evento `storage`
 * mantém as abas em sincronia.
 */

const STORAGE_KEY = "lc-culture-store:cart";
export const MAX_QTY_PER_ITEM = 10;

type CartLine = { sku: string; qty: number };

export type CartEntry = { product: Product; qty: number; subtotalCents: number };

const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();

/** Cache do snapshot: `useSyncExternalStore` exige referência estável entre leituras. */
let cachedLines: CartLine[] = EMPTY;
let cachedRaw: string | null = null;

function parseLines(raw: string): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    // Descarta SKU que saiu do catálogo e quantidade fora da faixa.
    const lines = parsed.flatMap((line): CartLine[] => {
      const sku = (line as CartLine)?.sku;
      const qty = Number((line as CartLine)?.qty);
      if (typeof sku !== "string" || !findProduct(sku)) return [];
      if (!Number.isInteger(qty) || qty < 1) return [];
      return [{ sku, qty: Math.min(qty, MAX_QTY_PER_ITEM) }];
    });
    return lines.length > 0 ? lines : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): CartLine[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = raw ? parseLines(raw) : EMPTY;
  }
  return cachedLines;
}

function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", emit);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", emit);
  };
}

function write(lines: CartLine[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // localStorage indisponível (modo privado, cota) — segue só em memória.
  }
  cachedRaw = null; // invalida o cache para o próximo getSnapshot reparsear
  emit();
}

/** Sinaliza quando já estamos no cliente, sem setState em efeito. */
const subscribeNoop = () => () => {};
const hydratedOnClient = () => true;
const hydratedOnServer = () => false;

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isHydrated = useSyncExternalStore(subscribeNoop, hydratedOnClient, hydratedOnServer);

  const add = useCallback((sku: string) => {
    if (!findProduct(sku)) return;
    const current = getSnapshot();
    const existing = current.find((line) => line.sku === sku);
    write(
      existing
        ? current.map((line) =>
            line.sku === sku ? { ...line, qty: Math.min(line.qty + 1, MAX_QTY_PER_ITEM) } : line,
          )
        : [...current, { sku, qty: 1 }],
    );
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    const current = getSnapshot();
    write(
      qty < 1
        ? current.filter((line) => line.sku !== sku)
        : current.map((line) =>
            line.sku === sku ? { ...line, qty: Math.min(qty, MAX_QTY_PER_ITEM) } : line,
          ),
    );
  }, []);

  const remove = useCallback((sku: string) => {
    write(getSnapshot().filter((line) => line.sku !== sku));
  }, []);

  const clear = useCallback(() => {
    if (getSnapshot().length > 0) write([]);
  }, []);

  return useMemo(() => {
    const entries = lines.flatMap((line): CartEntry[] => {
      const product = findProduct(line.sku);
      if (!product) return [];
      return [{ product, qty: line.qty, subtotalCents: product.priceCents * line.qty }];
    });

    return {
      entries,
      itemCount: entries.reduce((sum, entry) => sum + entry.qty, 0),
      totalCents: entries.reduce((sum, entry) => sum + entry.subtotalCents, 0),
      isHydrated,
      add,
      setQty,
      remove,
      clear,
    };
  }, [lines, isHydrated, add, setQty, remove, clear]);
}
