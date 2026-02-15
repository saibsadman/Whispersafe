-- CreateTable
CREATE TABLE "ReportAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "messageId" TEXT,
    "uploader" TEXT NOT NULL DEFAULT 'REPORTER',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ReportMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReportAttachment_reportId_createdAt_idx" ON "ReportAttachment"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportAttachment_messageId_idx" ON "ReportAttachment"("messageId");
