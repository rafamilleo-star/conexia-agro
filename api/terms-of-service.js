export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  res.status(200).send(`
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Termos de Serviço — CONÉXIA</title>

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
      max-width: 920px;
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
      font-weight: 700;
    }

    .subtitle {
      color: #A09890;
      font-size: 16px;
      max-width: 720px;
      margin: 0;
    }

    .card {
      margin-top: 30px;
      background: #141414;
      border: 1px solid #2A2A2A;
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 16px 50px rgba(0,0,0,.28);
    }

    h2 {
      font-size: 20px;
      margin: 30px 0 10px;
    }

    h2:first-child {
      margin-top: 0;
    }

    p {
      color: #C9C2BA;
      margin: 0 0 14px;
      font-size: 15px;
    }

    a {
      color: #C9A84C;
      text-decoration: none;
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

    <div class="eyebrow">Documento legal</div>
    <h1>Termos de Serviço</h1>

    <p class="subtitle">
      Regras de uso, responsabilidades e condições para utilização do CONÉXIA.
    </p>

    <section class="card">

      <h2>1. Finalidade</h2>
      <p>
        O CONÉXIA é uma plataforma de inteligência relacional destinada a apoiar
        a organização e manutenção de relacionamentos e informações associadas.
      </p>

      <h2>2. Conta e uso</h2>
      <p>
        O usuário é responsável pelas informações fornecidas, pela segurança de
        suas credenciais e pelo uso realizado em sua conta.
      </p>

      <p>
        O serviço não deve ser utilizado para fins ilegais, abusivos ou que violem
        direitos de terceiros.
      </p>

      <h2>3. Integrações</h2>
      <p>
        Funcionalidades com serviços de terceiros dependem de autorização do
        usuário e das regras desses provedores.
      </p>

      <p>
        O usuário pode revogar integrações quando desejar.
      </p>

      <h2>4. Conteúdo do usuário</h2>
      <p>
        O usuário mantém seus direitos sobre os dados e conteúdos que insere no
        CONÉXIA e declara possuir legitimidade para tratá-los no contexto de uso
        da plataforma.
      </p>

      <h2>5. Disponibilidade</h2>
      <p>
        Buscamos manter o serviço disponível e seguro, mas podem ocorrer
        interrupções, manutenção, alterações técnicas ou indisponibilidades de
        serviços de terceiros.
      </p>

      <h2>6. Privacidade</h2>
      <p>
        O tratamento de dados pessoais segue a Política de Privacidade do CONÉXIA.
      </p>

      <h2>7. Contato</h2>
      <p>
        Dúvidas ou solicitações:
        <a href="mailto:iagrosolucoes@gmail.com">iagrosolucoes@gmail.com</a>.
      </p>

      <div class="footer">
        Última atualização: 16 de outubro de 2026 · CONÉXIA — I.Agro Soluções
      </div>

    </section>
  </main>
</body>
</html>
  `);
}
