# 📄 Sistema de Documentos - Quaddra BPMN

## 🎯 Para que serve?

O sistema de documentos permite **anexar arquivos relacionados a cada processo**, como:

- 📋 **POPs** (Procedimentos Operacionais Padrão)
- 💻 **Instruções de Trabalho (IT)**
- 📊 **Planilhas de apoio**
- 📝 **Manuais**
- 🖼️ **Capturas de tela**
- 📄 **Outros documentos relevantes**

---

## 📂 Para onde vão os arquivos?

Quando você faz upload de um documento, ele é salvo **no servidor** na seguinte estrutura:

```
apps/api/storage/bpmn/
  └── [Nome do Processo]/
      ├── Comercial AS IS v2.0.bpmn  ← Arquivo BPMN do processo
      ├── Comercial TO BE v1.2.bpmn
      └── docs/  ← PASTA DE DOCUMENTOS
          ├── POP-COMER-002.pdf       ← Seus documentos aqui
          ├── IT-COMER-009.docx
          ├── planilha-comissoes.xlsx
          └── manual-usuario.pdf
```

### Exemplo prático:

Se você está no processo **"VS_1_ProcessoComercial_Cliente"** e faz upload de um arquivo chamado `POP-Vendas.pdf`, ele será salvo em:

```
C:\Projetos\Projeto Quaddra\quaddra\
  └── apps/api/storage/bpmn/
      └── VS_1_ProcessoComercial_Cliente/
          └── docs/
              └── POP-Vendas.pdf  ← Aqui!
```

---

## 🔄 Como funciona?

### 1. **Upload (Envio)**
```
Você → Clica "Fazer Upload" → Seleciona arquivo → 
Arquivo é enviado para /api/documents/[slug] → 
Salvo na pasta docs/ do processo
```

### 2. **Listagem**
```
Você abre Configurações → 
Frontend busca /api/documents/[slug] → 
API lê pasta docs/ → 
Retorna lista de arquivos com nome, tamanho, data
```

### 3. **Download**
```
Você clica "Download" → 
Frontend acessa /api/documents/[slug]/download/[filename] → 
API lê arquivo da pasta docs/ → 
Navegador faz download
```

---

## 📋 Formatos Aceitos

- **Documentos**: `.pdf`, `.docx`, `.doc`
- **Planilhas**: `.xlsx`, `.xls`
- **Texto**: `.txt`
- **Imagens**: `.png`, `.jpg`, `.jpeg`

---

## 🔒 Segurança

- ✅ Arquivos ficam isolados por processo (cada pasta docs/ é independente)
- ✅ Apenas formatos permitidos são aceitos
- ✅ Downloads são feitos via API controlada (não acesso direto ao sistema de arquivos)

---

## 🚀 Integração com GitHub (Futuro)

Quando configurarmos o **repositório GitHub**, os documentos também serão versionados:

```
repositorio-de-processos/  ← No GitHub
  └── processos/
      └── VS_1_ProcessoComercial_Cliente/
          ├── Comercial AS IS v2.0.bpmn
          └── docs/
              └── POP-Vendas.pdf  ← Versionado no Git!
```

**Vantagens:**
- 📜 Histórico de mudanças nos documentos
- 👥 Colaboração entre equipes
- 🔄 Sincronização automática
- 💾 Backup automático no GitHub

---

## 💡 Exemplos de Uso

### Cenário 1: Processo Comercial
```
Processo: VS_1_ProcessoComercial_Cliente
Documentos úteis:
  - POP-COMER-002-Processo-de-Vendas.pdf
  - IT-COMER-009-Cadastro-de-Lead.docx
  - Planilha-Comissoes-Vendas.xlsx
  - Manual-Ploomes.pdf
```

### Cenário 2: Processo Operacional
```
Processo: VS_2_ProcessoOperacional_SAC
Documentos úteis:
  - POP-SAC-Atendimento-Cliente.pdf
  - IT-SAC-Abertura-Chamado.docx
  - Fluxograma-Escalacao.png
```

### Cenário 3: Processo Financeiro
```
Processo: VS_3_ProcessoFinanceiro_Faturamento
Documentos úteis:
  - POP-FIN-Emissao-NFe.pdf
  - Modelo-Nota-Fiscal.xlsx
  - Manual-Sistema-Financeiro.pdf
```

---

## 🎯 Resumo

**O que é?**  
Sistema para anexar documentos relevantes a cada processo BPMN.

**Para onde vão?**  
Pasta `docs/` dentro do diretório de cada processo no servidor.

**Por quê?**  
Para centralizar toda documentação relacionada ao processo em um só lugar, facilitando acesso e manutenção.

**Como acessar?**  
Clique em "Configurações" → Role até "Documentos Associados" → Faça upload ou download.

---

**Dúvidas?** Verifique o arquivo `FUNCIONALIDADES_IMPLEMENTADAS.md` para mais detalhes técnicos.
