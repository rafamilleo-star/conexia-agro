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
    body {
      font-family: Arial, sans-serif;
      max-width: 760px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #1f2937;
    }

    h1 {
      color: #111827;
    }

    a {
      color: #2563eb;
    }
  </style>
</head>

<body>

  <h1>Exclusão de dados — CONÉXIA</h1>

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
    Poderemos solicitar confirmação de identidade antes de concluir o
    procedimento.
  </p>

  <p>
    Após a validação, os dados elegíveis serão excluídos ou anonimizados,
    ressalvadas informações que precisem ser mantidas para cumprimento de
    obrigações legais, prevenção a fraude ou exercício regular de direitos.
  </p>

</body>
</html>
  `);
}
