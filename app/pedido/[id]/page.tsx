import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PaymentPanel } from "@/components/PaymentPanel";
import { ArrowLeftIcon } from "@/components/Icons";
import { getOrder } from "@/lib/store";

export const metadata: Metadata = { title: "Pagamento Pix — LC Culture Store" };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:ring-2 focus-visible:ring-lc-amber-500 focus-visible:outline-none"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Voltar à vitrine
      </Link>

      <div className="mt-4">
        <PaymentPanel
          initialOrder={{
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
          }}
        />
      </div>
    </div>
  );
}
