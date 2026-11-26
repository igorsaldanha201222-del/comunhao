# Comunhão — plataforma SaaS para igrejas

Um produto, três partes, tudo na nuvem:

| Pasta | O que é | Onde roda |
|---|---|---|
| `supabase/` | Banco Postgres (multi-tenant com RLS), autenticação, arquivos e Edge Functions (pagamentos, push, energia solar) | Supabase |
| `apps/web` | Painel de gestão da igreja + site público de cada igreja (`/i/<codigo>`) + doação online | Vercel (Next.js 16) |
| `apps/mobile` | App dos membros (iOS/Android) com a cor e o nome da igreja | Expo / EAS (SDK 58) |
| `firmware/solar-esp32` | Medidor do inversor solar (ESP32 + RS485) que você vende como adicional | Arduino IDE |

O nome do produto fica em `apps/web/src/lib/brand.ts` e em `apps/mobile/app.json`.

## Módulos

- **Pessoas**: membros, visitantes, novos convertidos, atendimento pastoral.
- **Ministérios**: cadastro genérico com "cara" por tipo (louvor, diaconato, mídia, recepção, kids, intercessão, ensino, outro). Cada tipo já nasce com as funções padrão. Tem líderes, integrantes, escalas com confirmação pelo app e alerta de conflito no mesmo dia. O **louvor** ganha repertório (tom, BPM, cifra/áudio enviados) e setlist por escala.
- **Comunicação**: pregações (YouTube/áudio), banners com período, notificações push.
- **Eventos**: inscrição gratuita ou paga, limite de vagas, código de ingresso e check-in.
- **Doações**: Pix, cartão e boleto via Asaas, com repasse automático (split) para a carteira da igreja e taxa da plataforma.
- **Oração**: pedidos pelo app, com marcação de "orado".
- **Energia solar**: potência ao vivo, energia por dia, alertas de falha, sem geração e offline.

## Segurança (isolamento entre igrejas)

Todo dado tem `church_id`, e as políticas RLS do Postgres decidem quem vê o quê. Não é o front-end que decide. Os papéis são `owner`, `admin`, `leader` e `member`. O líder de ministério administra o próprio ministério mesmo sem ser da equipe da igreja. Os testes de RLS (38 casos) foram executados contra as migrations.

## Subindo em produção

### 1. Supabase
```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push                      # aplica supabase/migrations
npx supabase secrets set \
  ASAAS_API_URL=https://api-sandbox.asaas.com/v3 \
  ASAAS_API_KEY=<chave-do-asaas> \
  ASAAS_WEBHOOK_TOKEN=<token-forte-aleatorio> \
  PLATFORM_FEE_PERCENT=2
npx supabase functions deploy create-payment asaas-webhook send-notification solar-ingest
```
No SQL Editor, habilite `pg_cron` e agende a verificação de aparelhos offline e a limpeza:
```sql
select cron.schedule('solar-offline', '*/5 * * * *', $$select public.solar_check_offline()$$);
select cron.schedule('solar-prune',   '0 4 * * *',   $$select public.solar_prune()$$);
```
Em Authentication → URL Configuration, coloque a URL da Vercel como Site URL e adicione `https://<seu-dominio>/auth/callback`.

### 2. Asaas (pagamentos)
- Crie a conta da plataforma e gere a chave de API (comece pelo sandbox).
- Webhook: URL `https://<ref>.supabase.co/functions/v1/asaas-webhook`, com o mesmo token de `ASAAS_WEBHOOK_TOKEN`, eventos de cobrança.
- Para cada igreja, crie uma subconta e grave o `walletId` em `churches.payment_wallet_id`. Só a plataforma (service role) pode alterar esse campo.

### 3. Web (Vercel)
- Importe o repositório com **Root Directory = `apps/web`**.
- Variáveis: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. App (EAS)
```bash
cd apps/mobile
cp .env.example .env        # URL e chave pública do Supabase
npx eas-cli@latest init     # preenche o projectId (necessário para o push)
npx eas-cli@latest build --profile development --platform android
```
O push remoto não funciona no Expo Go do Android. Use um build de desenvolvimento.

### 5. Medidor solar
1. No painel, em Energia solar → Cadastrar aparelho, anote o token (ele só aparece uma vez).
2. Copie `firmware/solar-esp32/config.example.h` para `config.h` e preencha Wi-Fi, URL, token e perfil do inversor.
3. Grave pelo Arduino IDE (placa "ESP32 Dev Module").

**Mapas Modbus:** o perfil Huawei usa campos dentro dos blocos já lidos em campo na frota. Os perfis Growatt, Solis e Sungrow são ponto de partida tirado do manual e **precisam ser validados no equipamento** (potência e energia contra o display) antes de vender. GoodWe ainda não tem perfil.

## Desenvolvimento local
```bash
cd apps/web && npm install && npm run dev            # http://localhost:3000
cd apps/mobile && npm install && npx expo start
```

## Próximos passos sugeridos
- Kids (check-in de crianças com etiqueta), Células, Jornadas e Múltiplas igrejas (sede/filiais).
- Cobrança da assinatura SaaS das igrejas (planos em `churches.plan`).
- Fixar a CA raiz no firmware (hoje o TLS usa `setInsecure`).
- App publicado com o nome de cada igreja (white-label por loja), se algum cliente pedir.
