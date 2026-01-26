# 🔑 Configurar GitHub Token

Para a aplicação buscar processos do repositório `quaddra-processos`, você precisa configurar um token do GitHub.

## 📝 Passo a Passo

### 1. Criar Personal Access Token no GitHub

1. Acesse: https://github.com/settings/tokens
2. Clique em **"Generate new token"** → **"Generate new token (classic)"**
3. Preencha:
   - **Note:** `Quaddra Web App`
   - **Expiration:** `No expiration` (ou escolha um período)
   - **Scopes:** Marque apenas:
     - ✅ `repo` (Full control of private repositories)

4. Clique em **"Generate token"**
5. **COPIE O TOKEN** (você não verá ele novamente!)

---

### 2. Configurar no Projeto Local

No arquivo `.env.local` na pasta `apps/web/`:

```bash
GITHUB_TOKEN=ghp_seu_token_aqui
GITHUB_OWNER=4isaque4
GITHUB_REPO_PROCESSOS=quaddra-processos
GITHUB_BRANCH=main
```

---

### 3. Configurar no Servidor (VPS)

Via SSH, execute:

```bash
cd /var/www/quaddra/apps/web

# Criar arquivo .env.local
cat > .env.local << 'EOF'
GITHUB_TOKEN=ghp_seu_token_aqui
GITHUB_OWNER=4isaque4
GITHUB_REPO_PROCESSOS=quaddra-processos
GITHUB_BRANCH=main
EOF

# Reiniciar aplicação
pm2 restart quaddra-web
```

---

### 4. Configurar no GitHub Actions (Deploy Automático)

1. Acesse: https://github.com/4isaque4/quaddra/settings/secrets/actions
2. Clique em **"New repository secret"**
3. Adicione:
   - **Name:** `GITHUB_PROCESSOS_TOKEN`
   - **Value:** `ghp_seu_token_aqui`

---

## ✅ Testar

Após configurar, acesse:

```
http://localhost:3000/api/sync-processos
```

Deve retornar a lista de processos do repositório!

---

## 🔒 Segurança

- ⚠️ **NUNCA** commite o token no Git
- ⚠️ O arquivo `.env.local` já está no `.gitignore`
- ⚠️ Use tokens com permissões mínimas necessárias
- ⚠️ Revogue tokens antigos quando criar novos

---

**Última atualização:** Janeiro 2026
