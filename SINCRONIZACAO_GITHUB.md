# 🔄 Sincronização com GitHub - Guia Completo

## 📖 Como Funciona

O sistema mantém o site funcionando **exatamente como está** (lendo arquivos locais), mas adiciona a capacidade de **sincronizar processos do repositório GitHub** para os arquivos locais.

### Fluxo:

```
GitHub Repository → API /api/sync-github → Arquivos Locais → Site
```

---

## ✅ Vantagens desta Abordagem:

1. **Site continua funcionando do mesmo jeito** - Sem mudanças na interface ou na leitura de processos
2. **GitHub como fonte de verdade** - Processos gerenciados no repositório
3. **Sincronização sob demanda** - Você escolhe quando atualizar
4. **Sincronização automática** - Via webhook do GitHub (opcional)
5. **Backup automático** - Processos sempre salvos localmente

---

## 🚀 Como Usar:

### 1. **Sincronização Manual**

Acesse a URL para sincronizar:

```
http://localhost:3000/api/sync-github
```

Ou em produção:

```
https://quaddraconsultoria.com.br/api/sync-github
```

**O que acontece:**
- ✅ Busca todos os processos do repositório `quaddra-processos`
- ✅ Baixa arquivos BPMN principais
- ✅ Baixa subdiagramas (pasta `subdiagramas/`)
- ✅ Baixa documentos POP/IT (pasta `pop-it/`)
- ✅ Salva tudo em `apps/api/storage/bpmn/`
- ✅ Retorna relatório da sincronização

**Exemplo de Resposta:**

```json
{
  "success": true,
  "message": "Sincronização concluída",
  "totalArquivos": 15,
  "totalPastas": 3,
  "resultados": [
    {
      "pasta": "Comercial-v2.0",
      "status": "sucesso"
    },
    {
      "pasta": "RH-v1.0",
      "status": "sucesso"
    }
  ]
}
```

---

### 2. **Sincronização Automática (Webhook)**

Para atualizar automaticamente quando houver push no repositório:

#### Configurar no GitHub:

1. Acesse: https://github.com/4isaque4/quaddra-processos/settings/hooks
2. Clique em **"Add webhook"**
3. Configure:
   - **Payload URL:** `https://quaddraconsultoria.com.br/api/sync-github`
   - **Content type:** `application/json`
   - **Events:** Just the push event
   - **Active:** ✅ Marcado
4. Clique em **"Add webhook"**

**Pronto!** Agora, cada push no repositório sincronizará automaticamente! 🎉

---

## 📁 Estrutura no GitHub:

```
quaddra-processos/
├── Comercial-v2.0/
│   ├── comercial-v2.0.bpmn           ← Diagrama principal (obrigatório)
│   ├── subdiagramas/                 ← Subprocessos (opcional)
│   │   ├── prospectar-leads.bpmn
│   │   ├── qualificar-leads.bpmn
│   │   └── fechar-venda.bpmn
│   └── pop-it/                       ← Documentos (opcional)
│       ├── prospectar-leads/
│       │   ├── pop-prospeccao.pdf
│       │   └── it-crm.docx
│       └── qualificar-leads/
│           └── pop-qualificacao.pdf
│
├── RH-v1.0/
│   ├── rh-v1.0.bpmn
│   └── pop-it/
│       └── contratar-funcionario/
│           └── pop-contratacao.pdf
```

---

## 📂 Onde os Arquivos Ficam Salvos:

Todos os arquivos sincronizados são salvos em:

```
apps/api/storage/bpmn/
├── Comercial-v2.0/
│   ├── comercial-v2.0.bpmn
│   ├── subdiagramas/
│   │   ├── prospectar-leads.bpmn
│   │   ├── qualificar-leads.bpmn
│   │   └── fechar-venda.bpmn
│   └── pop-it/
│       ├── prospectar-leads/
│       │   ├── pop-prospeccao.pdf
│       │   └── it-crm.docx
│       └── qualificar-leads/
│           └── pop-qualificacao.pdf
└── RH-v1.0/
    ├── rh-v1.0.bpmn
    └── pop-it/
        └── contratar-funcionario/
            └── pop-contratacao.pdf
```

O **site continua lendo desses arquivos locais** como sempre fez! 🎯

---

## 🧪 Testando a Sincronização:

### 1. **Teste Local (Desenvolvimento)**

```bash
# Com servidor rodando (npm run dev)
curl http://localhost:3000/api/sync-github
```

Ou abra no navegador: http://localhost:3000/api/sync-github

### 2. **Teste em Produção**

```bash
curl https://quaddraconsultoria.com.br/api/sync-github
```

Ou abra no navegador: https://quaddraconsultoria.com.br/api/sync-github

### 3. **Verificar Logs**

No terminal onde o servidor está rodando, você verá:

```
[SYNC-GITHUB] Iniciando sincronização...
[SYNC-GITHUB] Encontradas 2 pastas de processos
[SYNC-GITHUB] Processando: Comercial-v2.0
[SYNC-GITHUB] Baixando: Comercial-v2.0/comercial-v2.0.bpmn
[SYNC-GITHUB] ✓ Salvo: ...
[SYNC-GITHUB] Sincronização concluída! Total de arquivos: 15
```

---

## 🔄 Fluxo de Trabalho Recomendado:

### Para Adicionar/Editar Processos:

1. **Editar no GitHub**
   - Acesse: https://github.com/4isaque4/quaddra-processos
   - Adicione/edite arquivos BPMN
   - Commit e push

2. **Sincronizar**
   - **Automático:** Se webhook estiver configurado, sincroniza sozinho
   - **Manual:** Acesse `/api/sync-github` se webhook não estiver ativo

3. **Pronto!** O site já exibe as mudanças

---

## ⚙️ Configuração Necessária:

Certifique-se que o `.env.local` está configurado:

```bash
GITHUB_TOKEN=ghp_seu_token_aqui
GITHUB_OWNER=4isaque4
GITHUB_REPO_PROCESSOS=quaddra-processos
GITHUB_BRANCH=main
```

---

## 🎯 Perguntas Frequentes:

### **P: O site vai parar de funcionar se o GitHub estiver offline?**
**R:** Não! O site lê dos arquivos locais. Apenas a sincronização ficará indisponível.

### **P: Preciso sincronizar toda vez que iniciar o servidor?**
**R:** Não! Os arquivos ficam salvos localmente. Só sincronize quando quiser atualizar.

### **P: Posso adicionar processos manualmente na pasta local?**
**R:** Sim! Você pode adicionar/editar arquivos diretamente em `apps/api/storage/bpmn/`.

### **P: E se eu editar um arquivo local e sincronizar depois?**
**R:** A sincronização sobrescreve os arquivos locais com os do GitHub. O GitHub é a fonte de verdade.

### **P: Como desfazer uma sincronização?**
**R:** Use Git para reverter os arquivos em `apps/api/storage/bpmn/` ou sincronize novamente após reverter o commit no GitHub.

---

## 📊 Logs e Monitoramento:

A API registra todas as ações:

- `[SYNC-GITHUB]` - Logs da sincronização
- `[WEBHOOK]` - Logs do webhook do GitHub
- Erros são registrados com detalhes

Verifique o console do servidor para acompanhar.

---

## 🔒 Segurança:

- O token do GitHub está protegido no `.env.local` (não commitado)
- Webhook aceita apenas eventos de push na branch `main`
- Arquivos são validados antes de serem salvos
- Nenhuma informação sensível é exposta nas APIs

---

**🎉 SINCRONIZAÇÃO IMPLEMENTADA COM SUCESSO!**

O site continua funcionando normalmente, agora com a capacidade de sincronizar processos do GitHub quando você quiser!

*Data: Janeiro 2026*
