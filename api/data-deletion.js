export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  res.status(200).send(`
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Exclusão de Dados — CONÉXIA</title>

  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at top, rgba(201,168,76,.08), transparent 34%),
        #0D0D0D;
      color: #F0EDE8;
      font-family: Inter, Arial, sans-serif;
      line-height: 1.65;
    }

    .shell {
      max-width: 820px;
      margin: 0 auto;
      padding: 56px 20px 80px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 36px;
      color: #C9A84C;
      font-weight: 700;
      letter-spacing: .08em;
      font-size: 13px;
      text-transform: uppercase;
    }

    .brand-mark {
      width: 30px;
      height: 30px;
      border: 1px solid #C9A84C;
      border-radius: 50%;
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 6px rgba(201,168,76,.06);
    }

    .brand-dot {
      width: 7px;
      height: 7px;
      background: #C9A84C;
      border-radius: 50%;
      box-shadow:
        0 -8px 0 -2px #C9A84C,
        7px 4px 0 -2px #C9A84C,
        -7px 4px 0 -2px #C9A84C;
    }

    .eyebrow {
      color: #A09890;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: .14em;
      margin-bottom: 10px;
    }

    h1 {
      font-size: clamp(34px, 6vw, 54px);
      line-height: 1.05;
      margin: 0 0 14px;
    }

    .subtitle {
      color: #A09890;
      font-size: 16px;
    }

    .card {
      margin-top: 30px;
      background: #141414;
      border: 1px solid #2A2A2A;
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 16px 50px rgba(0,0,0,.28);
    }

    p {
      color: #C9C2BA;
      margin: 0 0 16px;
      font-size: 15px;
    }

    strong {
      color: #F0EDE8;
    }

    a {
      color: #C9A84C;
      text-decoration: none;
    }

    .notice {
      margin-top: 22px;
      padding: 16px 18px;
      border-radius: 14px;
      background: #1A1508;
      border: 1px solid rgba(201,168,76,.28);
      color: #D7C89D;
    }

    .footer {
      margin-top: 34px;
      padding-top: 22px;
      border-top: 1px solid #2A2A2A;
      color: #8C8074;
      font-size: 12px;
    }
  </style>
</head>

<body>
  <main class="shell">

    <div class="brand">
      <div class="brand-mark">
        <div class="brand-dot"></div>
      </div>
      CONÉXIA
    </div>

    <div class="eyebrow">Privacidade</div>
    <h1>Exclusão de Dados</h1>

    <p class="subtitle">
      Como solicitar a remoção de dados pessoais associados à sua conta no CONÉXIA.
    </p>

    <section class="card">

      <p>
        Para solicitar a exclusão de dados pessoais associados à sua conta no
        CONÉXIA, envie um e-mail para
        <a href="mailto:iagrosolucoes@gmail.com">
          iagrosolucoes@gmail.com
        </a>
        usando o mesmo e-mail ou telefone associado à conta.
      </p>

      <p>
        No pedido, informe que deseja a
        <strong>exclusão dos dados do CONÉXIA</strong>.
      </p>

      <p>
        Poderemos solicitar confirmação de identidade antes de concluir o procedimento.
      </p>

      <div class="notice">
        Após a validação, os dados elegíveis serão excluídos ou anonimizados,
        ressalvadas informações que precisem ser mantidas para cumprimento de
        obrigações legais, prevenção a fraude ou exercício regular de direitos.
      </div>

      <div class="footer">
        CONÉXIA — I.Agro Soluções
      </div>

    </section>
  </main>
</body>
</html>
  `);
}
