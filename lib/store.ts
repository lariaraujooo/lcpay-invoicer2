import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { Redis } from "@upstash/redis";

/**
 * Persistência dos pedidos, com dois backends:
 *
 *   Redis  — usado quando há credenciais no ambiente (Vercel/produção).
 *   Arquivo JSON — usado no desenvolvimento local, sem depender de serviço externo.
 *
 * O backend de arquivo NÃO funciona em serverless: o filesystem da Vercel é
 * somente-leitura (fora do /tmp, que é efêmero e não é compartilhado entre
 * invocações — o webhook cairia numa instância sem o pedido).
 */

export type OrderStatus = "PENDING" | "PAID" | "FAILED";
export type PaidVia = "webhook" | "polling";

export type OrderItem = {
  sku: string;
  emoji: string;
  name: string;
  priceCents: number;
  qty: number;
};

export type Order = {
  id: string;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  /** Chave de conciliação devolvida pela LCPay na criação do Pix. */
  transactionId: string | null;
  /** Copia-e-cola (payload EMV) do Pix. */
  textContent: string | null;
  /** PNG do QR Code em base64, como a LCPay devolve. */
  qrImageBase64: string | null;
  qrCodeUrl: string | null;
  paidVia: PaidVia | null;
  paidAmountCents: number | null;
  endToEndId: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type PixCharge = {
  transactionId: string;
  textContent: string | null;
  qrImageBase64: string | null;
  qrCodeUrl: string | null;
};

/** Demo: 30 dias bastam e evitam crescer sem limite no plano free. */
const TTL_SECONDS = 30 * 24 * 60 * 60;

// ---------------------------------------------------------------- Redis

/**
 * A integração Upstash pelo Marketplace da Vercel injeta `KV_REST_API_*`;
 * a integração direta da Upstash injeta `UPSTASH_REDIS_REST_*`. Aceitamos as duas.
 */
function readRedisEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url?.trim() || !token?.trim()) return null;
  return { url: url.trim(), token: token.trim() };
}

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const env = readRedisEnv();
  redisClient = env ? new Redis(env) : null;
  return redisClient;
}

export function isUsingRedis(): boolean {
  return getRedis() !== null;
}

const orderKey = (id: string) => `lccs:order:${id}`;
const txKey = (transactionId: string) => `lccs:tx:${transactionId.toUpperCase()}`;
const paidKey = (id: string) => `lccs:paid:${id}`;

// ---------------------------------------------------------------- Arquivo

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");

type Database = { orders: Record<string, Order> };

/**
 * O webhook e o polling podem tocar o mesmo pedido ao mesmo tempo. Serializamos
 * o acesso ao arquivo numa fila de promises para que um read-modify-write não
 * sobrescreva o outro. Vive no globalThis porque o hot reload recria os módulos.
 */
const globalForStore = globalThis as unknown as { __lcpayStoreLock?: Promise<unknown> };

function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = globalForStore.__lcpayStoreLock ?? Promise.resolve();
  const result = previous.then(operation, operation);
  globalForStore.__lcpayStoreLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readDatabase(): Promise<Database> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    return parsed?.orders ? parsed : { orders: {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { orders: {} };
    throw error;
  }
}

/** Grava em arquivo temporário e renomeia: um crash no meio não corrompe o JSON. */
async function writeDatabase(database: Database): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = `${DATA_FILE}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(database, null, 2), "utf8");
  await rename(temporary, DATA_FILE);
}

// ---------------------------------------------------------------- API pública

/** Ex.: LCCS-20260715-A1B2 — vira o `numeroPedido` enviado à LCPay. */
function generateOrderId(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `LCCS-${today}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function newOrder(id: string, items: OrderItem[], totalCents: number): Order {
  return {
    id,
    items,
    totalCents,
    status: "PENDING",
    transactionId: null,
    textContent: null,
    qrImageBase64: null,
    qrCodeUrl: null,
    paidVia: null,
    paidAmountCents: null,
    endToEndId: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
}

export async function createOrder(items: OrderItem[], totalCents: number): Promise<Order> {
  const redis = getRedis();

  if (redis) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const order = newOrder(generateOrderId(), items, totalCents);
      // NX garante que um id sorteado duas vezes não sobrescreva um pedido existente.
      const stored = await redis.set(orderKey(order.id), order, { nx: true, ex: TTL_SECONDS });
      if (stored) return order;
    }
    throw new Error("Não foi possível gerar um id de pedido único.");
  }

  return withLock(async () => {
    const database = await readDatabase();
    let id = generateOrderId();
    while (database.orders[id]) id = generateOrderId();

    const order = newOrder(id, items, totalCents);
    database.orders[id] = order;
    await writeDatabase(database);
    return order;
  });
}

export async function getOrder(id: string): Promise<Order | null> {
  const redis = getRedis();
  if (redis) return (await redis.get<Order>(orderKey(id))) ?? null;

  const database = await readDatabase();
  return database.orders[id] ?? null;
}

export async function findOrderByTransactionId(transactionId: string): Promise<Order | null> {
  const redis = getRedis();
  if (redis) {
    const id = await redis.get<string>(txKey(transactionId));
    return id ? getOrder(id) : null;
  }

  const database = await readDatabase();
  const wanted = transactionId.toUpperCase();
  return (
    Object.values(database.orders).find((order) => order.transactionId?.toUpperCase() === wanted) ??
    null
  );
}

async function persist(order: Order): Promise<Order> {
  const redis = getRedis();
  if (redis) {
    await redis.set(orderKey(order.id), order, { ex: TTL_SECONDS });
    return order;
  }

  return withLock(async () => {
    const database = await readDatabase();
    database.orders[order.id] = order;
    await writeDatabase(database);
    return order;
  });
}

/** Guarda a cobrança devolvida pela LCPay e indexa o transactionId para o webhook. */
export async function attachCharge(id: string, charge: PixCharge): Promise<Order | null> {
  const order = await getOrder(id);
  if (!order) return null;

  const updated: Order = {
    ...order,
    transactionId: charge.transactionId,
    textContent: charge.textContent,
    qrImageBase64: charge.qrImageBase64,
    qrCodeUrl: charge.qrCodeUrl,
  };
  await persist(updated);

  const redis = getRedis();
  if (redis) await redis.set(txKey(charge.transactionId), id, { ex: TTL_SECONDS });

  return updated;
}

export async function markOrderFailed(id: string): Promise<Order | null> {
  const order = await getOrder(id);
  if (!order) return null;
  return persist({ ...order, status: "FAILED" });
}

/**
 * Marca o pedido como pago. Idempotente e com um único vencedor: a LCPay pode
 * reenviar a mesma notificação (até 30 vezes) e o polling pode chegar junto —
 * quem chegar primeiro define o `paidVia`.
 */
export async function markOrderPaid(
  id: string,
  details: { paidVia: PaidVia; paidAmountCents: number | null; endToEndId: string | null },
): Promise<Order | null> {
  const redis = getRedis();

  if (redis) {
    const claimed = await redis.set(paidKey(id), details.paidVia, { nx: true, ex: TTL_SECONDS });
    if (!claimed) return getOrder(id); // outro caminho já confirmou

    const order = await getOrder(id);
    if (!order) return null;
    return persist({
      ...order,
      status: "PAID",
      paidVia: details.paidVia,
      paidAmountCents: details.paidAmountCents,
      endToEndId: details.endToEndId,
      paidAt: new Date().toISOString(),
    });
  }

  return withLock(async () => {
    const database = await readDatabase();
    const order = database.orders[id];
    if (!order) return null;
    if (order.status === "PAID") return order;

    const updated: Order = {
      ...order,
      status: "PAID",
      paidVia: details.paidVia,
      paidAmountCents: details.paidAmountCents,
      endToEndId: details.endToEndId,
      paidAt: new Date().toISOString(),
    };
    database.orders[id] = updated;
    await writeDatabase(database);
    return updated;
  });
}
