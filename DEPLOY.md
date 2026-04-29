# Legere — Guia de Deploy: Vercel + Supabase

> Tempo estimado de configuração: **30–45 minutos**  
> Custo inicial: **R$ 0** (Supabase Free + Vercel Hobby são suficientes para começar)

---

## Visão geral da arquitetura

```
Usuário (navegador)
      │
      ▼
  Vercel CDN          ← frontend React/Vite compilado
      │
      ▼
  Supabase            ← PostgreSQL + Auth (bcrypt+JWT) + Row Level Security
```

Os dados de cada escritório são **100% isolados** por `tenant_id` via RLS diretamente no banco. Mesmo que alguém descubra um ID, não consegue acessar dados de outro tenant.

---

## Parte 1 — Configurar o Supabase

### 1.1 Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e faça login (ou crie conta grátis).
2. Clique em **New project**.
3. Preencha:
   - **Name:** `juriscloud` (ou o nome que preferir)
   - **Database Password:** crie uma senha forte e **guarde em local seguro**
   - **Region:** `South America (São Paulo)` — menor latência para Brasil
4. Clique em **Create new project** e aguarde 1–2 minutos.

### 1.2 Aplicar o schema SQL

1. No painel do Supabase, vá em **SQL Editor** (menu esquerdo).
2. Clique em **New query**.
3. Abra o arquivo `supabase/migrations/001_schema.sql` do projeto.
4. Copie todo o conteúdo e cole no editor SQL.
5. Clique em **Run** (▶️).
6. Você deve ver `Success. No rows returned` ao final — isso é correto.

> **O que o script cria:**
> - 13 tabelas (tenants, users, clients, cases, transactions, tasks, deadlines, hearings, events, channels, chat_messages, notifications, publications)
> - Row Level Security em todas as tabelas (cada escritório vê apenas seus dados)
> - Trigger automático que cria o perfil do usuário ao fazer cadastro
> - Índices de performance

### 1.3 Coletar as credenciais

1. No painel do Supabase, clique em ⚙️ **Project Settings** → **API**.
2. Copie e guarde com segurança:
   - **Project URL** — algo como `https://xyzabcdef.supabase.co`
   - **anon public** key — chave longa começando com `eyJhbGci...`

> ⚠️ **Nunca use a `service_role` key no frontend.** Ela bypassa toda a segurança. Use apenas a `anon` key.

### 1.4 Configurar autenticação

1. No painel Supabase, vá em **Authentication** → **Providers**.
2. Certifique-se de que **Email** está habilitado (já vem ativo por padrão).
3. Opcional: em **Authentication** → **Email Templates**, personalize os e-mails de confirmação com a identidade do Legere.
4. Em **Authentication** → **URL Configuration**, adicione a URL de produção quando souber (ex: `https://legere.tech`).

---

## Parte 2 — Configurar o Vercel

### 2.1 Fazer o push do código para o GitHub

Se ainda não tiver o repositório no GitHub:

```bash
# Na pasta do projeto
git init
git add .
git commit -m "chore: initial commit Legere SaaS"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/juriscloud.git
git push -u origin main
```

### 2.2 Criar o projeto no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub.
2. Clique em **Add New → Project**.
3. Importe o repositório `juriscloud`.
4. Vercel detecta automaticamente que é um projeto **Vite** — não altere nada.
5. **Não clique em Deploy ainda.** Primeiro configure as variáveis de ambiente.

### 2.3 Configurar variáveis de ambiente

Na tela de configuração do projeto Vercel, ou em **Settings → Environment Variables**, adicione:

| Nome da variável         | Valor                                     |
|--------------------------|-------------------------------------------|
| `VITE_SUPABASE_URL`      | URL do projeto Supabase (passo 1.3)       |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon public` do Supabase (passo 1.3) |

> As variáveis com prefixo `VITE_` são expostas ao frontend pelo Vite. Estão corretas porque são credenciais públicas (anon key + URL), protegidas pelo RLS no banco.

### 2.4 Fazer o deploy

1. Clique em **Deploy**.
2. Aguarde 1–3 minutos enquanto o Vercel compila o projeto.
3. Ao concluir, você receberá uma URL como `https://juriscloud-xxxx.vercel.app`.

### 2.5 Atualizar a URL no Supabase

1. Volte ao painel Supabase → **Authentication → URL Configuration**.
2. Em **Site URL**, coloque a URL do Vercel: `https://juriscloud-xxxx.vercel.app`
3. Em **Redirect URLs**, adicione:
   - `https://juriscloud-xxxx.vercel.app/**`
4. Salve.

---

## Parte 3 — Domínio personalizado (opcional)

### 3.1 No Vercel

1. Vá em **Settings → Domains**.
2. Digite o domínio que você possui (ex: `app.legere.tech`).
3. Siga as instruções para configurar o DNS no seu registrador de domínio (Registro.br, GoDaddy, Cloudflare, etc.).

### 3.2 Atualizar no Supabase

Repita o passo 2.5, substituindo a URL do Vercel pelo seu domínio personalizado.

---

## Parte 4 — Fluxo de deploy contínuo

A partir de agora, o deploy é automático:

```
git add .
git commit -m "feat: nova funcionalidade"
git push
```

O Vercel detecta o push e faz o deploy automaticamente em 1–3 minutos. Zero downtime.

---

## Parte 5 — Variáveis de ambiente locais (desenvolvimento)

Crie um arquivo `.env.local` na raiz do projeto (já está no `.gitignore`):

```env
VITE_SUPABASE_URL=https://xyzabcdef.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Com esse arquivo presente, o app usa Supabase real em vez do modo localStorage.  
Sem ele, o app roda em modo demo/localStorage (útil para testar sem internet).

---

## Parte 6 — Primeiro acesso em produção

1. Acesse a URL do Vercel.
2. Clique em **Registrar novo escritório**.
3. Preencha os dados do escritório, escolha o plano e crie o administrador.
4. O sistema cria o tenant no banco e o usuário admin via Supabase Auth.
5. Faça login com o e-mail e senha do administrador.

> **Nota:** O Supabase Free envia confirmação de e-mail por padrão. Para desativar durante testes, vá em **Authentication → Settings** e desmarque "Enable email confirmations".

---

## Checklist final

- [ ] Projeto Supabase criado na região São Paulo
- [ ] SQL `001_schema.sql` aplicado com sucesso
- [ ] Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas no Vercel
- [ ] Deploy bem-sucedido (sem erros na build)
- [ ] URL de produção atualizada no Supabase (Site URL + Redirect URLs)
- [ ] Primeiro cadastro de escritório testado em produção
- [ ] Login e logout funcionando
- [ ] `.env.local` criado localmente para desenvolvimento

---

## Limites do plano gratuito

| Recurso         | Supabase Free       | Vercel Hobby         |
|-----------------|---------------------|----------------------|
| Banco de dados  | 500 MB              | —                    |
| Autenticação    | 50.000 usuários/mês | —                    |
| Bandwidth       | 5 GB/mês            | 100 GB/mês           |
| Builds          | —                   | Ilimitados           |
| Custom domain   | —                   | 1 domínio            |
| Projetos        | 2 projetos          | ilimitado (Hobby)    |

Para produção com múltiplos clientes, considere o **Supabase Pro (US$ 25/mês)** — sem limite de projetos, backups automáticos diários e suporte.

---

## Suporte

- Documentação Supabase: [supabase.com/docs](https://supabase.com/docs)
- Documentação Vercel: [vercel.com/docs](https://vercel.com/docs)
- Comunidade Supabase: [github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
