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
    body {
      font-family: Arial, sans-serif;
      max-width: 860px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #1f2937;
    }

    h1, h2 {
      color: #111827;
    }

    small {
      color: #6b7280;
    }

    a {
      color: #2563eb;
    }
  </style>
</head>

<body>

  <h1>Política de Privacidade — CONÉXIA</h1>

  <small>Última atualização: 16 de outubro de 2026</small>

  <p>
    O CONÉXIA, produto da I.Agro Soluções, respeita a privacidade e a proteção
    dos dados pessoais de seus usuários. Esta política explica quais dados podem
    ser tratados, para quais finalidades e quais são os direitos dos usuários.
  </p>

  <h2>1. Dados tratados</h2>

  <p>
    Podemos tratar dados fornecidos diretamente pelo usuário, como nome,
    e-mail, telefone, informações de perfil, contatos e registros de interações
    inseridos no CONÉXIA.
  </p>

  <p>
    Quando o usuário autoriza integrações, também podemos tratar os dados
    necessários para funcionalidades específicas, como agenda, contatos e
    mensagens.
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
    <a href="mailto:iagrosolucoes@gmail.com">
      iagrosolucoes@gmail.com
    </a>.
  </p>

  <h2>8. Contato</h2>

  <p>
    Para dúvidas sobre privacidade e proteção de dados:
    <a href="mailto:iagrosolucoes@gmail.com">
      iagrosolucoes@gmail.com
    </a>.
  </p>

  <h2>9. Alterações</h2>

  <p>
    Esta política poderá ser atualizada para refletir mudanças no produto,
    integrações, legislação ou práticas de segurança.
  </p>

</body>
</html>
  `);
}
