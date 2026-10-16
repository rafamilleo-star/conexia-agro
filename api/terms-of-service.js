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

  <h1>Termos de Serviço — CONÉXIA</h1>

  <small>Última atualização: 16 de outubro de 2026</small>

  <p>
    Estes Termos regulam o uso do CONÉXIA, produto da I.Agro Soluções.
    Ao utilizar o serviço, o usuário concorda com estas condições.
  </p>

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
    <a href="mailto:iagrosolucoes@gmail.com">
      iagrosolucoes@gmail.com
    </a>.
  </p>

</body>
</html>
  `);
}
