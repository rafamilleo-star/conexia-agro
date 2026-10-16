export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  res.status(200).send(`
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Política de Privacidade — CONÉXIA</title>

  <style>
    * {
      box-sizing: border-box;
    }

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

    .hero {
      margin-bottom: 28px;
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
      color: #F0EDE8;
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

    a:hover {
      text-decoration: underline;
    }

    .footer {
      margin-top: 34px;
      padding-top: 22px;
      border-top: 1px solid #2A2A2A;
      color: #8C8074;
      font-size: 12px;
    }

    @media (max-width: 640px) {
      .shell {
        padding-top: 32px;
      }

      .card {
        padding: 22px;
        border-radius: 16px;
      }
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

    <section class="hero">
      <div class="eyebrow">Documento legal</div>
      <h1>Política de Privacidade</h1>
      <p class="subtitle">
        Como o CONÉXIA trata dados pessoais, integrações e informações relacionadas ao uso da plataforma.
      </p>
    </section>

    <section class="card">

      <h2>1. Dados tratados</h2>
      <p>
        Podemos tratar dados fornecidos diretamente pelo usuário, como nome,
        e-mail, telefone, informações de perfil, contatos e registros de interações
        inseridos no CONÉXIA.
      </p>

      <p>
        Quando o usuário autoriza integrações, também podemos tratar os dados
        necessários para funcionalidades específicas, como agenda, contatos e mensagens.
      </p>

      <h2>2. Finalidades</h2>
      <p>
        Os dados são utilizados para disponibilizar as funcionalidades do CONÉXIA,
        organizar informações de relacionamento, gerar lembretes e insights,
        permitir integrações autorizadas, manter a segurança, prestar suporte e
        melhorar o serviço.
      </p>

      <h2>3. WhatsApp e integrações</h2>
      <p>
        Quando o usuário utiliza funcionalidades de WhatsApp ou outras integrações,
        os dados são tratados apenas para executar as ações solicitadas e fornecer
        o serviço.
      </p>

      <p>
        O CONÉXIA não vende dados pessoais.
      </p>

      <h2>4. Compartilhamento</h2>
      <p>
        Dados podem ser processados por provedores de infraestrutura e serviços
        tecnológicos estritamente necessários à operação do CONÉXIA, observadas
        medidas de segurança e proteção de dados.
      </p>

      <p>
        Também poderemos compartilhar informações quando exigido por lei ou
        autoridade competente.
      </p>

      <h2>5. Armazenamento e segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados
        contra acesso não autorizado, perda, alteração ou divulgação indevida.
      </p>

      <h2>6. Direitos do titular</h2>
      <p>
        O usuário pode solicitar confirmação do tratamento, acesso, correção,
        atualização ou exclusão de dados, quando aplicável, bem como revogar
        autorizações concedidas a integrações.
      </p>

      <h2>7. Exclusão de dados</h2>
      <p>
        Pedidos de exclusão podem ser feitos pelo e-mail
        <a href="mailto:iagrosolucoes@gmail.com">iagrosolucoes@gmail.com</a>.
      </p>

      <h2>8. Contato</h2>
      <p>
        Para dúvidas sobre privacidade e proteção de dados:
        <a href="mailto:iagrosolucoes@gmail.com">iagrosolucoes@gmail.com</a>.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Esta política poderá ser atualizada para refletir mudanças no produto,
        integrações, legislação ou práticas de segurança.
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
