# LC Culture Store

Loja interna de demonstração para testar a integração de pagamentos **Pix** com a **API da LC Pay**.
Não tem finalidade comercial: existe para exercitar o fluxo ponta a ponta.

```
Vitrine → Carrinho → Resumo → Pagar com Pix → Cobrança na LC Pay → QR Code → Pagamento → Confirmação
```

Nove itens simbólicos da cultura do time, de **R$ 0,10 a R$ 1,00** — valores baixos porque os testes
usam Pix real.

---

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as credenciais (veja abaixo)
npm run dev                  # http://localhost:3000
```

### Credenciais

No painel LC Pay, menu **"Tokens PDV"** → digite um nome → **Adicionar** → ícone **Copiar**.
O bloco copiado traz a **Conta** e o **Token**. Preencha o `.env.local`:

| Variável | O que é | Obrigatória |
|---|---|---|
| `LCPAY_BASE_URL` | `https://api.lcpay.com.br` (produção) ou `https://api-hml.lcpay.com.br` (homologação) | usa produção por padrão |
| `LCPAY_ACCOUNT_ID` | Conta, do bloco copiado no painel | sim |
| `LCPAY_TOKEN` | Token de integração (validade ~2 anos) | sim |
| `LCPAY_WEBHOOK_API_KEY` | Chave que a LC Pay envia no header `X-Api-Key` do webhook. Sem ela o webhook fica desligado e vale o polling | não |
| `PUBLIC_BASE_URL` | URL HTTPS pública da app. Vazio = webhook desligado. Na Vercel é detectada sozinha | não |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Redis dos pedidos. Vazio no localhost (usa arquivo); **obrigatório na Vercel** | só em serverless |

> ⚠️ Apontando para produção, **os Pix são reais** — o valor é debitado de verdade. O token dá
> acesso à conta: trate-o como senha e nunca versione o `.env.local`.

---

## Como o pagamento é confirmado

A doc da LC Pay oferece dois caminhos, e a app usa **os dois**, como recomendado:

**Webhook** (principal) — informamos `urlCallBackIntegrador` ao criar o Pix; quando é pago, a LC Pay
faz um `POST` em `/api/webhooks/lcpay` com o **corpo vazio** e os dados nos headers.

**Consulta de status** (fallback oficial) — a tela do QR consulta `/api/orders/[id]` a cada ~3s, que
por sua vez chama `consultarTransactions` na LC Pay enquanto o pedido estiver pendente.

O `urlCallBackIntegrador` só é enviado quando **as duas** condições existem:

1. **URL pública HTTPS** — a LC Pay precisa nos alcançar. Em `localhost` não há como; na Vercel é
   automática.
2. **`LCPAY_WEBHOOK_API_KEY`** — sem ela não conseguimos provar que a notificação veio da LC Pay, e
   a rota é pública. Aceitar sem validar deixaria qualquer um marcar pedidos como pagos.

Faltando qualquer uma, omitimos o campo — que é o jeito documentado de dizer "não quero notificação"
— e a confirmação fica com a consulta de status. O fluxo funciona igual; só o rótulo na tela muda
de *"Webhook da LC Pay"* para *"Consulta de status"*. Para ligar o webhook, peça a chave ao time
LC Pay e adicione a variável.

### Testar o webhook de verdade

Suba um túnel HTTPS e aponte a `PUBLIC_BASE_URL` para ele:

```bash
ngrok http 3000
# copie a URL https, coloque em .env.local e reinicie o npm run dev
PUBLIC_BASE_URL=https://xxxx.ngrok-free.app
```

Feito isso, a confirmação passa a chegar pela notificação da LC Pay — a tela do pedido mostra
**"Confirmado por: Webhook da LC Pay"** em vez de "Consulta de status".

---

## Deploy na Vercel

Publicando, a app ganha URL pública HTTPS e **o webhook passa a funcionar sozinho** — a
`urlCallBackIntegrador` é montada a partir da URL do projeto, sem ngrok e sem configurar nada.

Dois passos no painel da Vercel, uma vez só:

1. **Storage → Upstash for Redis** (plano free). O filesystem das funções serverless é
   somente-leitura, então o arquivo JSON não serve lá. A integração injeta `KV_REST_API_URL` e
   `KV_REST_API_TOKEN` sozinha. Sem isso a app avisa em vermelho no topo.
2. **Settings → Environment Variables**: `LCPAY_ACCOUNT_ID` e `LCPAY_TOKEN` (marque como
   *Sensitive*). A `LCPAY_WEBHOOK_API_KEY` é opcional — sem ela vale o polling.

> A LC Pay precisa alcançar `/api/webhooks/lcpay` sem autenticação. Se **Deployment Protection**
> estiver ligada no projeto, a notificação recebe uma tela de login em vez da rota, e o pagamento
> só confirma pelo polling.

O `data/orders.json` continua sendo usado no localhost — a escolha do backend é automática, pela
presença das variáveis do Redis.

---

## Arquitetura

**Next.js 16 (App Router) + TypeScript + Tailwind v4**, runtime Node.

O token e o `accountId` **nunca saem do servidor**: o browser fala só com as rotas da app, e elas
falam com a LC Pay. Nenhuma credencial é exposta como `NEXT_PUBLIC_*`.

```
Browser ──► /api/checkout ──► lib/lcpay.ts ──► LC Pay  POST /pixCashIn
   ▲                                                      │
   │  QR + copia-e-cola                                    ▼
   └──── /api/orders/[id] ◄── store ◄── /api/webhooks/lcpay ◄── LC Pay (pago)
         (polling ~3s, fallback)         (X-Api-Key, idempotente)
```

| Arquivo | Papel |
|---|---|
| `lib/lcpay.ts` | Cliente da API: `createPixCharge()`, `getTransactionStatus()` |
| `lib/products.ts` | Catálogo — fonte de verdade dos preços |
| `lib/store.ts` | Pedidos: Redis (serverless) ou `data/orders.json` (local) |
| `lib/config.ts` | Lê e valida as variáveis de ambiente |
| `app/api/checkout/` | Cria o pedido e gera a cobrança |
| `app/api/orders/[id]/` | Status + consulta de fallback |
| `app/api/webhooks/lcpay/` | Recebe e concilia a notificação |

### Decisões que valem explicação

**Dinheiro em centavos.** Preços são inteiros no domínio inteiro; a conversão para reais acontece só
no `valorTotal` enviado à API. Somar `0.1 + 0.2` em float daria `0.30000000000000004`.

**O cliente não define preço.** O checkout recebe apenas SKU e quantidade e recalcula o total pelo
catálogo do servidor. Preço adulterado no browser é ignorado.

**O webhook não é a única palavra.** Como o corpo vem vazio, a notificação afirma "foi pago" sem
dizer o valor. Validamos a `X-Api-Key` (comparação em tempo constante) e **confirmamos via
`consultarTransactions`** antes de liberar o pedido. A conciliação é idempotente por `transactionId`
(a LC Pay reenvia até 30 vezes) e responde 2xx sempre que a chave é válida, para não gerar retry à toa.

**Validamos antes de enviar.** A doc avisa que o `pixCashIn` *não aplica Bean Validation* e que
valores inválidos tendem a virar 500 — então o payload é checado antes do POST.

### O que a documentação não conta

**Valor mínimo de R$ 0,59 por transação.** Não aparece em nenhuma página da doc. Cobrar R$ 0,10
devolve `422 Operação inválida. O valor da transação deve ser de no mínimo: R$ 0,59`. Cinco dos
nove itens custam menos que isso, então o carrinho precisa somar ao menos `MIN_CHARGE_CENTS`
([lib/products.ts](lib/products.ts)) — o botão de pagar fica bloqueado até lá, informando quanto
falta, e o servidor barra por garantia.

**`pixCashIn` vs `pixCashin`.** A página *"URLs Produção e Homologação"* grafa o path com `i`
minúsculo, divergindo do **OpenAPI oficial** e da página do endpoint. O código segue o OpenAPI.

**"Conta" não é o número da conta.** O `accountId` do path é o **GUID** que aparece em `Conta:` no
bloco do botão *Copiar* (menu "Tokens PDV") — algo como `133BD098-F481-48D6-6F7F-A357E09DEB45`.
Usar outro identificador devolve `400 Conta cadastrada no sistema não pertence ao usuário`, que
sugere falta de permissão quando na verdade é o valor errado. Em 400/401/403 o checkout registra um
diagnóstico no log (formato das credenciais, sem expor valores) para separar os dois casos.

---

## Verificação

```bash
npx tsc --noEmit && npx eslint . && npm run build
```

O fluxo foi exercitado ponta a ponta contra um mock que devolve os formatos documentados, cobrindo:
total do carrinho (os 9 itens = **R$ 4,60**, enviado como `valorTotal: 4.6`), confirmação por polling
e por webhook, `X-Api-Key` inválida (401, pedido intacto), webhook de transação **não paga** (recusado),
reenvio do mesmo webhook (não duplica), token inválido (401 tratado, pedido `FAILED`, nada vazado no
log) e preço adulterado no cliente (ignorado).

Para o teste com **Pix real**: compre o "Café do Time" (R$ 0,10), pague pelo app do banco e a tela deve
virar "Pagamento confirmado" sozinha.
