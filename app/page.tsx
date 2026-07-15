import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS } from "@/lib/products";

export default function VitrinePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-text-strong sm:text-4xl">
          Reconhecimento que cabe no{" "}
          <span className="text-lc-amber-600 dark:text-lc-amber-400">dia a dia</span>
        </h1>
        <p className="mt-3 text-base leading-relaxed text-text-body">
          Itens simbólicos que celebram a cultura do time. Escolha, monte o carrinho e finalize
          com Pix — o pagamento é processado pela API da LC Pay.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="vitrine">
        <h2 id="vitrine" className="sr-only">
          Produtos disponíveis
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product) => (
            <li key={product.sku} className="flex">
              <div className="flex-1">
                <ProductCard product={product} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
