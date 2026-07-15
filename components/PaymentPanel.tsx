"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCart } from "@/components/CartContext";
import {
  AlertIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  PixIcon,
  SpinnerIcon,
} from "@/components/Icons";
import { formatBRL } from "@/lib/products";
import type { OrderItem, OrderStatus, PaidVia } from "@/lib/store";

type OrderView = {
  id: string;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  textContent: string | null;
  qrImageBase64: string | null;
  paidVia: PaidVia | null;
  paidAmountCents: number | null;
  createdAt: string;
  paidAt: string | null;
};

const POLL_INTERVAL_MS = 3_000;
/** Depois disso paramos de consultar sozinhos e deixamos o usuário decidir. */
const POLL_LIMIT_MS = 10 * 60 * 1000;

export function PaymentPanel({ initialOrder }: { initialOrder: OrderView }) {
  const [order, setOrder] = useState<OrderView>(initialOrder);
  const [copied, setCopied] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  // Falhas seguidas na consulta significam que não conseguimos confirmar sozinhos.
  // Precisa aparecer: senão a tela diz "aguardando" para sempre e o usuário acha
  // que o pagamento dele não caiu.
  const [pollFailures, setPollFailures] = useState(0);
  const startedAt = useRef(0);
  const { clear } = useCart();

  // O pedido já existe no servidor com a cobrança gerada — o carrinho cumpriu seu papel.
  // O relógio do polling também só começa no cliente (Date.now() é impuro no render).
  useEffect(() => {
    startedAt.current = Date.now();
    clear();
  }, [clear]);

  const isPending = order.status === "PENDING";

  const checkStatus = useCallback(async (): Promise<OrderStatus | null> => {
    try {
      const response = await fetch(`/api/orders/${initialOrder.id}`, { cache: "no-store" });
      if (!response.ok) {
        setPollFailures((count) => count + 1);
        return null;
      }
      const payload = (await response.json()) as { order?: OrderView; pollError?: boolean };
      if (!payload.order) {
        setPollFailures((count) => count + 1);
        return null;
      }
      setOrder(payload.order);
      // `pollError` = a rota respondeu, mas a consulta à LC Pay falhou. Sem contar
      // isso, um gateway fora do ar fica indistinguível de "ainda não pagaram".
      setPollFailures((count) => (payload.pollError ? count + 1 : 0));
      return payload.order.status;
    } catch {
      // Rede oscilando não muda o pedido: a próxima tentativa (ou o webhook) resolve.
      setPollFailures((count) => count + 1);
      return null;
    }
  }, [initialOrder.id]);

  /**
   * Fallback documentado do webhook: consulta o status enquanto o pedido está
   * pendente. Pausa com a aba em segundo plano e para na confirmação.
   */
  useEffect(() => {
    if (!isPending || pollTimedOut) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (cancelled) return;

      if (Date.now() - startedAt.current > POLL_LIMIT_MS) {
        setPollTimedOut(true);
        return;
      }
      if (document.visibilityState === "visible") {
        const status = await checkStatus();
        if (cancelled || status === "PAID") return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS);

    // Ao voltar para a aba, consulta na hora em vez de esperar o próximo ciclo.
    function onVisibility() {
      if (document.visibilityState === "visible") void checkStatus();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isPending, pollTimedOut, checkStatus]);

  async function handleManualCheck() {
    setIsChecking(true);
    setPollTimedOut(false);
    startedAt.current = Date.now();
    await checkStatus();
    setIsChecking(false);
  }

  async function handleCopy() {
    if (!order.textContent) return;
    try {
      await navigator.clipboard.writeText(order.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (order.status === "PAID") {
    return <PaidPanel order={order} />;
  }

  if (order.status === "FAILED" || !order.textContent) {
    return (
      <section className="rounded-xl border border-border-subtle bg-surface-card p-6 text-center sm:p-8">
        <AlertIcon className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 text-lg font-semibold text-text-strong">
          Não foi possível gerar a cobrança
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
          O pedido <span className="font-mono">{order.id}</span> não chegou a ter um Pix válido
          gerado na LC Pay. Nenhum valor foi cobrado. Monte o carrinho novamente para tentar.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-lc-amber-500 px-4 text-sm font-semibold text-lc-ink transition-colors hover:bg-lc-amber-400 focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Voltar à vitrine
        </Link>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card">
      <header className="border-b border-border-subtle px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="inline-flex items-center gap-2 text-base font-semibold text-text-strong">
            <PixIcon className="h-4.5 w-4.5 text-lc-purple-600 dark:text-lc-purple-400" />
            Pague com Pix
          </h1>
          <span className="font-mono text-xs text-text-muted">{order.id}</span>
        </div>
      </header>

      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[248px]">
          <div className="rounded-xl border border-border-subtle bg-white p-3">
            {order.qrImageBase64 ? (
              // QR devolvido pela LC Pay em base64 — não geramos o código localmente.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${order.qrImageBase64}`}
                alt={`QR Code Pix para pagar ${formatBRL(order.totalCents)} no pedido ${order.id}`}
                width={224}
                height={224}
                className="mx-auto block h-auto w-full"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 p-4 text-center text-xs text-slate-500">
                A LC Pay não retornou a imagem do QR. Use o código copia-e-cola ao lado.
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs leading-relaxed text-text-muted">
            Abra o app do seu banco, escolha Pix e aponte para o código.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-4">
            <span className="text-sm font-medium text-text-body">Total a pagar</span>
            <span className="tabular text-2xl font-bold text-text-strong">
              {formatBRL(order.totalCents)}
            </span>
          </div>

          <ul className="mt-4 space-y-1.5">
            {order.items.map((item) => (
              <li key={item.sku} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-text-muted">
                  <span aria-hidden="true">{item.emoji}</span> {item.name}
                  {item.qty > 1 && <span className="tabular"> × {item.qty}</span>}
                </span>
                <span className="tabular shrink-0 text-text-body">
                  {formatBRL(item.priceCents * item.qty)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <label
              htmlFor="pix-copia-cola"
              className="text-xs font-semibold tracking-wide text-text-body uppercase"
            >
              Pix copia e cola
            </label>
            <textarea
              id="pix-copia-cola"
              readOnly
              rows={3}
              value={order.textContent}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1.5 w-full resize-none rounded-lg border border-border-subtle bg-surface-muted p-3 font-mono text-[11px] leading-relaxed break-all text-text-body focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card focus-visible:outline-none ${
                copied
                  ? "border-lc-purple-600 bg-lc-purple-600 text-white focus-visible:ring-lc-purple-600"
                  : "border-border-subtle text-text-body hover:bg-surface-muted focus-visible:ring-lc-amber-500"
              }`}
            >
              {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              {copied ? "Código copiado" : "Copiar código"}
            </button>
          </div>

          <StatusRow
            pollTimedOut={pollTimedOut}
            isChecking={isChecking}
            onCheck={handleManualCheck}
            isDegraded={pollFailures >= 3}
          />
        </div>
      </div>
    </section>
  );
}

function StatusRow({
  pollTimedOut,
  isChecking,
  onCheck,
  isDegraded,
}: {
  pollTimedOut: boolean;
  isChecking: boolean;
  onCheck: () => void;
  isDegraded: boolean;
}) {
  // Falhando de forma persistente: se o pagamento já foi feito, ele está seguro —
  // o que quebrou foi a nossa confirmação. Dizer isso evita que a pessoa pague de novo.
  if (isDegraded && !pollTimedOut) {
    return (
      <div
        role="status"
        className="mt-5 rounded-lg bg-red-50 p-3 text-xs leading-relaxed text-red-700 dark:bg-red-500/10 dark:text-red-300"
      >
        <p className="flex items-start gap-2">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Não estamos conseguindo confirmar o pagamento com a LC Pay. Se você já pagou,{" "}
            <strong>não pague de novo</strong> — a transação está registrada no seu banco. Tente
            verificar em instantes.
          </span>
        </p>
        <button
          type="button"
          onClick={onCheck}
          disabled={isChecking}
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-surface-card px-3.5 text-xs font-semibold text-text-body transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none disabled:opacity-60 dark:border-red-500/30"
        >
          {isChecking ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : null}
          Verificar agora
        </button>
      </div>
    );
  }

  if (pollTimedOut) {
    return (
      <div className="mt-5 rounded-lg border border-border-subtle bg-surface-muted p-3">
        <p className="text-xs leading-relaxed text-text-muted">
          Paramos de verificar automaticamente. Se você já pagou, confirme abaixo.
        </p>
        <button
          type="button"
          onClick={onCheck}
          disabled={isChecking}
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3.5 text-xs font-semibold text-text-body transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:outline-none disabled:opacity-60"
        >
          {isChecking ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : null}
          Já paguei, verificar agora
        </button>
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className="mt-5 flex items-center gap-2.5 rounded-lg bg-lc-amber-50 p-3 text-xs font-medium text-lc-amber-900 dark:bg-lc-amber-500/10 dark:text-lc-amber-200"
    >
      <SpinnerIcon className="h-4 w-4 shrink-0 animate-spin" />
      Aguardando a confirmação do pagamento…
    </div>
  );
}

function PaidPanel({ order }: { order: OrderView }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-card p-6 text-center sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
        <CheckCircleIcon className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
      </div>

      <h1 className="mt-5 text-xl font-bold text-text-strong">Pagamento confirmado</h1>
      <p className="mt-2 text-sm text-text-body">
        Recebemos{" "}
        <span className="tabular font-semibold text-text-strong">
          {formatBRL(order.paidAmountCents ?? order.totalCents)}
        </span>{" "}
        do pedido <span className="font-mono text-xs">{order.id}</span>.
      </p>

      <dl className="mx-auto mt-6 max-w-xs space-y-2 border-t border-border-subtle pt-5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Status</dt>
          <dd className="font-semibold text-emerald-600 dark:text-emerald-400">APPROVED</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Confirmado por</dt>
          <dd className="text-text-body">
            {order.paidVia === "webhook" ? "Webhook da LC Pay" : "Consulta de status"}
          </dd>
        </div>
        {order.paidAt && (
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Data</dt>
            <dd className="tabular text-text-body">
              {new Date(order.paidAt).toLocaleString("pt-BR")}
            </dd>
          </div>
        )}
      </dl>

      <ul className="mx-auto mt-6 max-w-xs space-y-1 border-t border-border-subtle pt-5 text-left text-xs text-text-muted">
        {order.items.map((item) => (
          <li key={item.sku} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              <span aria-hidden="true">{item.emoji}</span> {item.name}
              {item.qty > 1 && <span className="tabular"> × {item.qty}</span>}
            </span>
            <span className="tabular shrink-0">{formatBRL(item.priceCents * item.qty)}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-7 inline-flex h-11 items-center rounded-lg bg-lc-amber-500 px-5 text-sm font-semibold text-lc-ink transition-colors hover:bg-lc-amber-400 focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card focus-visible:outline-none"
      >
        Voltar à vitrine
      </Link>
    </section>
  );
}
