/**
 * Catálogo da LC Culture Store.
 *
 * Preços ficam em centavos (inteiros) em todo o domínio. A conversão para reais
 * acontece só na fronteira da API da LCPay, em `valorTotal`.
 */

export type Product = {
  sku: string;
  emoji: string;
  name: string;
  description: string;
  priceCents: number;
};

export const PRODUCTS: readonly Product[] = [
  {
    sku: "CAFE-TIME",
    emoji: "☕",
    name: "Café do Time",
    description: "Uma pausa para recarregar as energias",
    priceCents: 10,
  },
  {
    sku: "SNACK-PRODUTIVIDADE",
    emoji: "🍫",
    name: "Snack da Produtividade",
    description: "Um incentivo para seguir o dia",
    priceCents: 20,
  },
  {
    sku: "VALEU-DEMAIS",
    emoji: "🏆",
    name: "Valeu Demais!",
    description: "Reconhecimento simbólico por uma boa entrega",
    priceCents: 30,
  },
  {
    sku: "IDEIA-TRANSFORMA",
    emoji: "💡",
    name: "Ideia que Transforma",
    description: "Para valorizar uma boa ideia ou iniciativa",
    priceCents: 40,
  },
  {
    sku: "ESPIRITO-TIME",
    emoji: "🤝",
    name: "Espírito de Time",
    description: "Reconhecimento por colaboração e parceria",
    priceCents: 50,
  },
  {
    sku: "PROJETO-ENTREGUE",
    emoji: "🚀",
    name: "Projeto Entregue",
    description: "Para celebrar uma entrega importante",
    priceCents: 60,
  },
  {
    sku: "META-BATIDA",
    emoji: "🎯",
    name: "Meta Batida",
    description: "Comemoração por um objetivo alcançado",
    priceCents: 70,
  },
  {
    sku: "DESTAQUE-MES",
    emoji: "⭐",
    name: "Destaque do Mês",
    description: "Reconhecimento por uma contribuição especial",
    priceCents: 80,
  },
  {
    sku: "COMBO-CONQUISTA",
    emoji: "🎉",
    name: "Combo Conquista",
    description: "Para celebrar uma grande conquista em equipe",
    priceCents: 100,
  },
] as const;

const BY_SKU = new Map(PRODUCTS.map((product) => [product.sku, product]));

export function findProduct(sku: string): Product | undefined {
  return BY_SKU.get(sku);
}

/** Formata centavos como moeda brasileira: 460 -> "R$ 4,60". */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
