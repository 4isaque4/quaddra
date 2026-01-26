# Quaddra - Sistema de Gestão de Processos BPMN

Sistema web para visualização e gestão de processos de negócio em formato BPMN.

## 🚀 Funcionalidades

- ✅ Visualização interativa de diagramas BPMN
- ✅ Popup arrastável com controles de zoom e minimizar
- ✅ Sistema de descrições detalhadas para cada elemento
- ✅ Upload e download de documentos associados
- ✅ Agrupamento automático por categoria
- ✅ Seletor de diagramas quando há múltiplas versões
- ✅ Sincronização com repositório Git remoto

## 📋 Requisitos

- Node.js 20+ (ou 22+)
- npm 9+
- Git

## 🔧 Instalação

```bash
npm install
```

## 🏃 Desenvolvimento

Em dois serviços simultâneos (web 3000, api 4000):

```bash
npm run dev
```

## 📁 Estrutura do Projeto

```
quaddra/
├── apps/
│   ├── web/          # Frontend Next.js
│   └── api/          # Backend Fastify
│       └── storage/
│           └── bpmn/ # Arquivos BPMN
├── tools/            # Scripts utilitários
└── Processos/        # Arquivos .bpm originais
```

## 📊 Como Usar

### 1. Adicionar Novos Processos BPMN

1. Exporte o arquivo `.bpm` do Bizagi como `.bpmn`
2. Coloque em `apps/api/storage/bpmn/[pasta]/`
3. Execute: `npm run extract-bpmn`
4. Acesse: `http://localhost:3000/processos`

### 2. Visualizar Processos

- **Clique simples**: Mostra detalhes no painel lateral
- **Duplo clique**: Abre popup arrastável com controles de zoom
- **Scroll do mouse**: Zoom no diagrama
- **Clique e arraste**: Mover o diagrama

### 3. Controles do Popup

- **Zoom**: Botões `+` e `−` na barra superior
- **Minimizar**: Botão de minimizar na barra superior
- **Maximizar**: Botão de maximizar na barra superior
- **Arrastar**: Clique e arraste pela barra laranja
- **Fechar**: Botão `×` ou botão "Fechar"

### 4. Sincronizar com Repositório Remoto

```powershell
.\sync-git.ps1
```

Ou manualmente:

```bash
git add .
git commit -m "Mensagem do commit"
git push origin main
```

## 🔗 Repositório Remoto

O projeto está conectado ao repositório:
- **URL**: `https://github.com/4isaque4/quaddra.git`
- **Branch**: `main`

## 📚 Documentação Adicional

- [CONFIGURACAO_BPMN.md](CONFIGURACAO_BPMN.md) - Guia completo de configuração de arquivos BPMN
- [sync-git.ps1](sync-git.ps1) - Script de sincronização Git

## 🛠️ Scripts Disponíveis

- `npm run dev` - Inicia servidores de desenvolvimento
- `npm run build` - Build para produção
- `npm run extract-bpmn` - Extrai descrições dos arquivos BPMN
- `.\sync-git.ps1` - Sincroniza com repositório remoto

## 📝 Notas

- Os arquivos BPMN são listados automaticamente do diretório `apps/api/storage/bpmn/`
- As descrições são extraídas automaticamente e salvas em `descriptions.flat.json`
- O sistema suporta múltiplos diagramas por processo (AS IS, TO BE, etc.)
- Documentos podem ser associados aos processos na pasta `docs/` de cada processo
