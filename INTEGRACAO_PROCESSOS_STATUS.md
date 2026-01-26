# 📊 Status da Integração com Repositório de Processos

## ✅ O QUE JÁ FOI FEITO:

### 1. Repositório `quaddra-processos` Criado
- ✅ Estrutura de pastas definida
- ✅ README com instruções simples
- ✅ Exemplo de processo incluído
- ✅ Repositório no GitHub (privado)

### 2. APIs Criadas na Aplicação Web
- ✅ `/api/sync-processos` - Sincroniza processos do GitHub
- ✅ `/api/popit/[processo]/[atividade]` - Lista documentos POP/IT
- ✅ Webhook configurado para atualização automática

### 3. Dependências Adicionadas
- ✅ `@octokit/rest` - Para integração com GitHub API

### 4. Documentação
- ✅ `README.md` no repositório de processos
- ✅ `CONFIGURAR_GITHUB_TOKEN.md` - Como configurar token

---

## 🔄 PRÓXIMOS PASSOS (EM ANDAMENTO):

### 1. Configurar GitHub Token
📝 Siga o guia: `CONFIGURAR_GITHUB_TOKEN.md`

Você precisa:
- Criar token no GitHub
- Adicionar no `.env.local` local
- Adicionar no servidor VPS
- Adicionar nos secrets do GitHub Actions

### 2. Modificar Modal de Detalhes da Atividade
Adicionar seção de documentos POP/IT no modal que abre ao duplo clique

Deve incluir:
- Lista de documentos da atividade (do repositório)
- Botão para download
- Link para adicionar novos no GitHub

### 3. Atualizar Página de Processos
Modificar `/processos` para buscar processos do repositório GitHub automaticamente

### 4. Instalar Dependências
Executar `npm install` no projeto para instalar `@octokit/rest`

---

## 📝 ESTRUTURA ATUAL DOS ARQUIVOS:

```
quaddra/
├── apps/web/
│   ├── app/api/
│   │   ├── sync-processos/
│   │   │   └── route.ts              ✅ Criado
│   │   └── popit/
│   │       └── [processo]/
│   │           └── [atividade]/
│   │               └── route.ts      ✅ Criado
│   ├── components/
│   │   └── BpmnViewer.tsx            🔄 Precisa modificar
│   ├── .env.example                  ✅ Criado
│   └── package.json                  ✅ Atualizado
│
├── CONFIGURAR_GITHUB_TOKEN.md        ✅ Criado
└── INTEGRACAO_PROCESSOS_STATUS.md    ✅ Criado (este arquivo)

quaddra-processos/ (repositório separado)
├── Exemplo-Processo-v1.0/            ✅ Criado
│   ├── exemplo-processo-v1.0.bpmn
│   └── pop-it/
└── README.md                          ✅ Criado
```

---

## 🚀 COMANDOS PARA CONTINUAR:

### 1. Instalar dependências
```bash
cd "C:/Projetos/Projeto Quaddra/quaddra"
npm install
```

### 2. Configurar token do GitHub
Siga: `CONFIGURAR_GITHUB_TOKEN.md`

### 3. Testar API localmente
```bash
# Iniciar servidor
cd apps/web
npm run dev

# Testar em outro terminal:
curl http://localhost:3000/api/sync-processos
```

### 4. Commitar mudanças
```bash
git add .
git commit -m "feat: adicionar integração com repositório de processos BPMN"
git push origin main
```

---

## 📋 TAREFAS PENDENTES:

- [ ] Configurar GitHub Token
- [ ] Modificar modal de detalhes (adicionar seção POP/IT)
- [ ] Atualizar página /processos para buscar do GitHub
- [ ] Instalar dependências (`npm install`)
- [ ] Testar APIs localmente
- [ ] Deploy com novas funcionalidades

---

## 💡 COMO FUNCIONA (FLUXO COMPLETO):

1. **Adicionar Processo:**
   - Pessoa adiciona pasta no `quaddra-processos`
   - Inclui arquivo `.bpmn` e documentos POP/IT
   - Faz commit e push

2. **Sincronização:**
   - GitHub envia webhook para `/api/sync-processos`
   - API busca novos processos
   - Site atualiza automaticamente em ~2 minutos

3. **Visualização:**
   - Usuário acessa `/processos`
   - Lista mostra processos do GitHub
   - Ao clicar, carrega BPMN do repositório

4. **Documentos POP/IT:**
   - Usuário dá duplo clique em atividade
   - Modal mostra documentos vinculados do GitHub
   - Pode fazer download direto

---

**Última atualização:** Janeiro 2026  
**Status:** 🔄 Integração 60% completa
