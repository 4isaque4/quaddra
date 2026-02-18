-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "arquivoBpmn" TEXT NOT NULL,
    "categoria" TEXT,
    "folderPath" TEXT,
    "clientType" TEXT NOT NULL DEFAULT 'quaddra',
    "githubPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_elements" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "ator" TEXT,
    "descricao" TEXT,
    "entradas" JSONB NOT NULL DEFAULT '[]',
    "saidas" JSONB NOT NULL DEFAULT '[]',
    "ferramentas" JSONB NOT NULL DEFAULT '[]',
    "passoAPasso" JSONB NOT NULL DEFAULT '[]',
    "popItReferencia" JSONB NOT NULL DEFAULT '[]',
    "observacoes" JSONB NOT NULL DEFAULT '[]',
    "fonteDocx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_custom_names" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "customName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_custom_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_element_edits" (
    "id" TEXT NOT NULL,
    "processSlug" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "bpmnUrl" TEXT NOT NULL,
    "editedData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_element_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_documents" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "folder" TEXT,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_audit_logs" (
    "id" TEXT NOT NULL,
    "processId" TEXT,
    "elementId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "changes" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processes_slug_key" ON "processes"("slug");

-- CreateIndex
CREATE INDEX "processes_slug_idx" ON "processes"("slug");

-- CreateIndex
CREATE INDEX "processes_clientType_idx" ON "processes"("clientType");

-- CreateIndex
CREATE INDEX "processes_categoria_idx" ON "processes"("categoria");

-- CreateIndex
CREATE INDEX "processes_createdAt_idx" ON "processes"("createdAt");

-- CreateIndex
CREATE INDEX "process_elements_processId_idx" ON "process_elements"("processId");

-- CreateIndex
CREATE INDEX "process_elements_elementId_idx" ON "process_elements"("elementId");

-- CreateIndex
CREATE INDEX "process_elements_nome_idx" ON "process_elements"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "process_elements_processId_elementId_key" ON "process_elements"("processId", "elementId");

-- CreateIndex
CREATE UNIQUE INDEX "process_custom_names_processId_key" ON "process_custom_names"("processId");

-- CreateIndex
CREATE INDEX "process_element_edits_processSlug_idx" ON "process_element_edits"("processSlug");

-- CreateIndex
CREATE INDEX "process_element_edits_elementId_idx" ON "process_element_edits"("elementId");

-- CreateIndex
CREATE UNIQUE INDEX "process_element_edits_processSlug_elementId_bpmnUrl_key" ON "process_element_edits"("processSlug", "elementId", "bpmnUrl");

-- CreateIndex
CREATE INDEX "process_documents_processId_idx" ON "process_documents"("processId");

-- CreateIndex
CREATE INDEX "process_documents_folder_idx" ON "process_documents"("folder");

-- CreateIndex
CREATE INDEX "process_audit_logs_processId_idx" ON "process_audit_logs"("processId");

-- CreateIndex
CREATE INDEX "process_audit_logs_elementId_idx" ON "process_audit_logs"("elementId");

-- CreateIndex
CREATE INDEX "process_audit_logs_action_idx" ON "process_audit_logs"("action");

-- CreateIndex
CREATE INDEX "process_audit_logs_createdAt_idx" ON "process_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "process_elements" ADD CONSTRAINT "process_elements_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_custom_names" ADD CONSTRAINT "process_custom_names_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_documents" ADD CONSTRAINT "process_documents_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
