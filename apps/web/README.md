# Quaddra Web - Frontend

## 🚀 Tecnologias

- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS utilitário
- **BPMN.js** - Visualizador de diagramas BPMN

## 📁 Estrutura do Projeto

```
apps/web/
├── app/                          # App Router do Next.js
│   ├── globals.css              # Estilos globais e Tailwind
│   ├── layout.tsx               # Layout principal
│   ├── page.tsx                 # Página inicial
│   └── processos/               # Páginas de processos BPMN
│       ├── page.tsx             # Lista de processos
│       └── [slug]/              # Página dinâmica de cada processo
│           └── page.tsx
├── components/                   # Componentes React
│   ├── Header.tsx               # Cabeçalho com navegação
│   ├── Hero.tsx                 # Seção principal
│   ├── Services.tsx             # Seção de serviços
│   ├── About.tsx                # Seção sobre nós
│   ├── Contact.tsx              # Formulário de contato
│   ├── Footer.tsx               # Rodapé
│   ├── BpmnViewer.tsx           # Visualizador BPMN
│   └── index.ts                 # Exportações dos componentes
├── package.json                  # Dependências
├── tailwind.config.ts           # Configuração do Tailwind
└── tsconfig.json                # Configuração TypeScript
```

## 🎨 Componentes

### Header
- Navegação responsiva
- Menu mobile com hambúrguer
- Logo da Quaddra

### Hero
- Seção principal com call-to-action
- Design responsivo e moderno

### Services
- Cards de serviços com ícones
- Grid responsivo

### About
- Informações sobre a empresa
- Layout em duas colunas

### Contact
- Formulário de contato funcional
- Validação e feedback

### Footer
- Rodapé com branding

### BpmnViewer
- Visualizador de diagramas BPMN
- Tooltips com descrições
- Integração com arquivos JSON processados

## 🚀 Como Executar

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Executar em desenvolvimento:**
   ```bash
   npm run dev
   ```

3. **Acessar:**
   - **Site principal:** http://localhost:3000
   - **Processos BPMN:** http://localhost:3000/processos

## 🎯 Funcionalidades

- ✅ Site institucional completo
- ✅ Design responsivo (mobile-first)
- ✅ Navegação suave entre seções
- ✅ Visualização de processos BPMN
- ✅ Formulário de contato funcional
- ✅ Integração com Tailwind CSS
- ✅ Componentes reutilizáveis
- ✅ TypeScript para tipagem

## 🎨 Design System

### Cores
- **Primária:** Orange (#ff6f00)
- **Cinza escuro:** #333
- **Cinza médio:** #606770
- **Cinza claro:** #f0f2f5
- **Branco:** #ffffff

### Tipografia
- **Fonte:** Poppins (400, 600, 700)
- **Fallbacks:** System fonts

### Componentes
- **Botões:** Bordas arredondadas, hover effects
- **Cards:** Sombras, hover animations
- **Formulários:** Focus states, validação visual

## 📱 Responsividade

- **Mobile:** Menu hambúrguer, layout em coluna
- **Tablet:** Grid adaptativo
- **Desktop:** Layout em múltiplas colunas

## 🔧 Configurações

### Tailwind CSS
- Configurado com cores customizadas
- Componentes utilitários
- Responsive breakpoints

### TypeScript
- Path mapping (@/components)
- Strict mode habilitado
- Next.js types

## 📊 Integração BPMN

O projeto integra com os arquivos BPMN processados:
- Arquivos .bpmn em `/api/storage/bpmn/`
- Descrições em `/api/storage/descriptions.flat.json`
- Visualização interativa com tooltips

## 🚀 Deploy

- **Build:** `npm run build`
- **Start:** `npm run start`
- **Lint:** `npm run lint`

## 📝 Próximos Passos

- [ ] Adicionar mais processos BPMN
- [ ] Implementar autenticação
- [ ] Dashboard administrativo
- [ ] API para formulário de contato
- [ ] Testes automatizados
