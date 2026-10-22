# Recuperação do WhatsApp Meta do Conexia

## Estado identificado em 22/10/2026

O Conexia usa a Meta Cloud API. O domínio indicado pelo próprio aplicativo é `https://conexia-agro-chi.vercel.app`. Nesse domínio, o token permite consultar o número e o aplicativo I.Agro está inscrito no WABA. O número +55 11 98863-0785 retorna `is_on_biz_app=true` e `platform_type=ON_PREMISE`, em vez de `CLOUD_API`. O log do Supabase contém erros `133010 — Account not registered` depois de 09/10.

O domínio `https://conexia-agro.vercel.app` apresentou token inválido nas mesmas consultas. É necessário conferir qual projeto Vercel recebe os webhooks e executa os crons; os domínios não têm configurações backend equivalentes.

## Recuperação de coexistência

Entre na conta Meta que administra o número e verifique o fluxo de **Meta Business Suite → Caixa de entrada → WhatsApp**. Se existir a opção de começar/conectar o número, conclua o onboarding de coexistência existente. Alternativamente, use o fluxo oficial de Embedded Signup para conectar a conta do WhatsApp Business app. Se a Meta apresentar erro, registre a mensagem e os identificadores do ativo para avaliação de provisionamento pela Meta.

Não exclua a conta do WhatsApp Business do celular, não desregistre o número e não execute chamadas convencionais de registro repetidamente. No onboarding de coexistência concluído, a Meta orienta pular a etapa de registro separado: o número já deve estar registrado.

O estado esperado após recuperação é:

```json
{"is_on_biz_app":true,"platform_type":"CLOUD_API"}
```

Depois, confirme o callback de mensagens apontando para `/api/meta-whatsapp-webhook`, com o verify token correspondente, e faça um teste controlado de recebimento/resposta. Aceitação da API com `wamid` não comprova entrega: verifique a chegada ao aparelho e os eventos de status.

## Configuração do código

`WHATSAPP_PROVIDER=meta` é a configuração de envio. `META_WHATSAPP_TOKEN` e `META_WEBHOOK_VERIFY_TOKEN` são segredos e devem ser configurados apenas no ambiente protegido do projeto Vercel, nunca no Git.

`META_PHONE_NUMBER_ID` e `META_WHATSAPP_PHONE_NUMBER_ID` são aliases. Defina um deles ou use valores iguais nos dois. Divergência é bloqueada para não responder por outro número. `META_WABA_ID` permite configurar o WABA correspondente. Os defaults do ativo já utilizado foram preservados na implementação.

A rota `meta-fix-waba-subscription` é apenas diagnóstico GET. Não registra, desregistra, migra nem repara a conta da Meta.

## Mensagens proativas

Fora da janela de atendimento de 24 horas, mensagens proativas precisam de templates Meta aprovados. A correção de provisionamento não elimina essa exigência. Os templates devem preservar a finalidade da mensagem; não substituir todo lembrete por um anúncio genérico apenas para contornar a regra.

## Referências

- [Onboarding oficial de coexistência e confirmação de estado](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).
- [Códigos de erro Meta: 133010 e 131047](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes).
- [Relato de terceiros sobre reparo pela Caixa de entrada — não é garantia de solução](https://developers.facebook.com/community/threads/1320481073303179/).
