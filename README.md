# CONÉXIA — Sistema de Inteligência Relacional

Baseado no livro "Networking, além do cafezinho" de Rafael Milléo.

---

## PASSO A PASSO COMPLETO

### PASSO 1 — Baixar o projeto

Baixe o ZIP deste projeto e descompacte numa pasta no seu computador.

### PASSO 2 — Instalar Node.js

Se não tem Node.js instalado:
- Vá em https://nodejs.org
- Baixe a versão LTS
- Instale

Verifique:
```bash
node --version   # deve mostrar v18+ ou v20+
npm --version    # deve mostrar 9+
```

### PASSO 3 — Instalar dependências

Abra o terminal na pasta do projeto e rode:
```bash
npm install
```

### PASSO 4 — Configurar Supabase

1. Acesse https://supabase.com e crie uma conta (grátis)
2. Crie um novo projeto (ex: "conexia")
3. Anote a **Project URL** e a **anon public key** (em Settings > API)
4. Edite o arquivo `.env`:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

### PASSO 5 — Criar as tabelas

1. No Supabase, vá em **SQL Editor**
2. Copie TUDO do arquivo `supabase-setup.sql`
3. Cole no editor e clique **RUN**
4. Deve aparecer "Success"

### PASSO 6 — Configurar autenticação

No Supabase:
1. Vá em **Authentication > Settings**
2. Em "Email Auth", **desative** "Confirm email" (para facilitar testes)
3. Em "Site URL", coloque `http://localhost:5173` (para dev) ou sua URL final do Vercel

### PASSO 7 — Testar localmente

```bash
npm run dev
```

Abra http://localhost:5173 no navegador. Deve aparecer a tela de login do CONÉXIA.

Teste:
1. Crie uma conta
2. Complete o onboarding
3. Faça o assessment
4. Cadastre contatos
5. Registre interações

### PASSO 8 — Publicar no Vercel

1. Crie conta em https://vercel.com (grátis, pode logar com GitHub)
2. Instale Vercel CLI:

```bash
npm install -g vercel
```

3. Na pasta do projeto, rode:

```bash
vercel
```

4. Siga as perguntas:
   - Set up and deploy? **Y**
   - Which scope? (selecione sua conta)
   - Link to existing project? **N**
   - What's your project's name? **conexia**
   - In which directory is your code? **.** (ponto)
   - Want to modify settings? **N**

5. Configure as variáveis de ambiente:

```bash
vercel env add VITE_SUPABASE_URL
# cole a URL do Supabase

vercel env add VITE_SUPABASE_ANON_KEY
# cole a chave anon
```

6. Deploy de produção:

```bash
vercel --prod
```

7. Vercel vai gerar um link tipo: `https://conexia-xxx.vercel.app`

### PASSO 9 — Atualizar URL no Supabase

Volte no Supabase:
1. **Authentication > URL Configuration**
2. Em "Site URL", coloque sua URL do Vercel: `https://conexia-xxx.vercel.app`
3. Em "Redirect URLs", adicione: `https://conexia-xxx.vercel.app/**`

### PASSO 10 — Enviar para testadores

Envie o link do Vercel para os testadores. Cada um:
1. Cria sua própria conta
2. Faz onboarding
3. Faz assessment
4. Usa o CRM
5. Dados ficam no Supabase, isolados por RLS

### Para ativar o modo Admin

No arquivo `src/utils/theme.js`, mude:
```js
export const ENABLE_ADMIN_TOOLS = true;
```

E faça novo deploy: `vercel --prod`

Somente o email `rafaelmilleo@yahoo.com.br` verá Mentor + Exportar.

---

## Estrutura do projeto

```
conexia-app/
├── index.html
├── package.json
├── vite.config.js
├── .env                    ← suas credenciais (NÃO comitar)
├── .env.example
├── .gitignore
├── supabase-setup.sql      ← SQL completo para criar tabelas
├── README.md
└── src/
    ├── main.jsx            ← entry point
    ├── App.jsx             ← app completo (auth + onboard + assess + CRM)
    ├── data/
    │   └── constants.js    ← questões, segmentos, categorias, etc
    └── utils/
        ├── supabase.js     ← Supabase client
        └── theme.js        ← cores, admin config
```

## Segurança

- RLS ativo em todas as tabelas
- Cada usuário só vê seus dados
- Admin controlado por flag + email
- Chave anon é segura (RLS protege)
- Senha mínima 6 caracteres

---

CONÉXIA · "Networking, além do cafezinho" · Rafael Milléo
