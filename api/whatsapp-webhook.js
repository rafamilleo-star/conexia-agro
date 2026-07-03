CONÉXIA — Deploy: Agendamento de Ações Futuras no Bot do WhatsApp
====================================================================

3 arquivos, 3 ações no GitHub (repo rafamilleo-star/conexia-agro):

1) SUBSTITUIR api/whatsapp-webhook.js
   - Apaga todo o conteúdo atual e cola o conteúdo de whatsapp-webhook.js
   - Commit direto na main

2) CRIAR api/whatsapp-reminder-cron.js (arquivo novo, não existe ainda)
   - Cola o conteúdo de whatsapp-reminder-cron.js
   - Commit direto na main

3) SUBSTITUIR vercel.json (na raiz do repo)
   - Apaga todo o conteúdo atual e cola o conteúdo de vercel.json
   - Isso adiciona o bloco "crons" que faz a Vercel chamar o lembrete
     todo dia às 11:00 UTC (08:00 horário de Brasília)
   - Commit direto na main

Depois do deploy automático (1-2 min), não precisa mexer em mais nada.
O cron já fica agendado sozinho pela Vercel — não precisa configurar
nada no painel, a menos que o projeto seja Hobby e o cron não apareça
ativo (nesse caso, dá uma olhada em Vercel → Project → Settings → Cron Jobs
pra confirmar que ele foi reconhecido).

O QUE MUDOU
-----------
- O bot agora reconhece uma intenção nova: SCHEDULE_ACTION. Mensagens do tipo
  "preciso enviar X pro Fulano até segunda" ou "me lembra de ligar pra Ciclana
  semana que vem" agora são entendidas como uma AÇÃO FUTURA (não mais tratadas
  como "não entendi"), e ficam salvas no campo "próxima ação" do contato.
- Todo dia às 08:00 (horário de Brasília), a Vercel roda automaticamente o
  novo endpoint /api/whatsapp-reminder-cron, que varre todos os contatos com
  ação pendente vencendo naquele dia (ou atrasada) e manda o lembrete de
  verdade pelo WhatsApp pra quem pediu.
- Cada lembrete só é enviado uma vez (marca next_action_reminded_at no banco).

COMO TESTAR
-----------
1. No WhatsApp do bot, manda algo como:
   "Preciso enviar as fotos de levecto pro Rafael Vicentini na segunda"
   → Ele deve responder confirmando a ação futura com a data calculada.
2. Pra testar o lembrete sem esperar o cron rodar sozinho, dá pra chamar o
   endpoint manualmente no navegador ou com curl:
   https://conexia-agro-chi.vercel.app/api/whatsapp-reminder-cron
   (só funciona pra ações com next_action_date igual ou anterior a hoje)

OPCIONAL — travar o endpoint do cron
-------------------------------------
Hoje, qualquer pessoa que souber a URL pode chamar /api/whatsapp-reminder-cron
manualmente (baixo risco, só dispara os lembretes já devidos). Se quiser travar,
crie uma env var CRON_SECRET na Vercel com um valor aleatório — o código já
está pronto pra exigir esse header quando ela existir.
