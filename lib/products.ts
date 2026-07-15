/**
 * Catálogo da LC Culture Store.
 *
 * Preços ficam em centavos (inteiros) em todo o domínio. A conversão para reais
 * acontece só na fronteira da API da LCPay, em `valorTotal`.
 */

/**
 * Valor mínimo aceito pela LCPay numa transação Pix.
 *
 * NÃO está na documentação — descoberto em produção, ao tentar cobrar R$ 0,10:
 *   HTTP 422 "Operação inválida. O valor da transação deve ser de no mínimo: R$ 0,59"
 *
 * O catálogo começa exatamente neste valor, então hoje nenhum carrinho fica abaixo.
 * As checagens (aqui e no checkout) seguem valendo: elas guardam a regra do gateway,
 * não os preços atuais — baixar um preço sem elas voltaria a quebrar em produção.
 */
export const MIN_CHARGE_CENTS = 59;

export type Product = {
  sku: string;
  emoji: string;
  name: string;
  description: string;
  priceCents: number;
};

/**
 * Preços de R$ 0,59 a R$ 1,00: o piso é o mínimo que a LCPay aceita
 * (`MIN_CHARGE_CENTS`) e o teto é o limite definido para a demo. A escala original
 * do enunciado começava em R$ 0,10, o que deixava cinco itens impossíveis de comprar
 * sozinhos. A ordem simbólica — do café à conquista — foi preservada.
 */
export const PRODUCTS: readonly Product[] = [
  {
    sku: "CAFE-TIME",
    emoji: "☕",
    name: "Café do Time",
    description: "Uma pausa para recarregar as energias",
    priceCents: 59,
  },
  {
    sku: "SNACK-PRODUTIVIDADE",
    emoji: "🍫",
    name: "Snack da Produtividade",
    description: "Um incentivo para seguir o dia",
    priceCents: 65,
  },
  {
    sku: "VALEU-DEMAIS",
    emoji: "🏆",
    name: "Valeu Demais!",
    description: "Reconhecimento simbólico por uma boa entrega",
    priceCents: 70,
  },
  {
    sku: "IDEIA-TRANSFORMA",
    emoji: "💡",
    name: "Ideia que Transforma",
    description: "Para valorizar uma boa ideia ou iniciativa",
    priceCents: 75,
  },
  {
    sku: "ESPIRITO-TIME",
    emoji: "🤝",
    name: "Espírito de Time",
    description: "Reconhecimento por colaboração e parceria",
    priceCents: 80,
  },
  {
    sku: "PROJETO-ENTREGUE",
    emoji: "🚀",
    name: "Projeto Entregue",
    description: "Para celebrar uma entrega importante",
    priceCents: 85,
  },
  {
    sku: "META-BATIDA",
    emoji: "🎯",
    name: "Meta Batida",
    description: "Comemoração por um objetivo alcançado",
    priceCents: 90,
  },
  {
    sku: "DESTAQUE-MES",
    emoji: "⭐",
    name: "Destaque do Mês",
    description: "Reconhecimento por uma contribuição especial",
    priceCents: 95,
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
