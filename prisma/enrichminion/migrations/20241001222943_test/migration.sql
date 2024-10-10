-- CreateTable
CREATE TABLE "BreakPoint" (
    "LogID" TEXT NOT NULL,
    "ApiCode" INTEGER NOT NULL,
    "Emails" TEXT[]
);

-- CreateTable
CREATE TABLE "EmailVerificationLogs" (
    "LogID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "emails" INTEGER NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailVerificationLogs_pkey" PRIMARY KEY ("LogID")
);

-- CreateTable
CREATE TABLE "EnrichmentLogs" (
    "LogID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "Date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentLogs_pkey" PRIMARY KEY ("LogID")
);

-- CreateTable
CREATE TABLE "User" (
    "UserID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "phoneNumber" TEXT,
    "location" TEXT,
    "currency" TEXT,
    "credits" INTEGER NOT NULL,
    "apikey" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("UserID")
);

-- CreateTable
CREATE TABLE "Admin" (
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "BreakPoint_LogID_key" ON "BreakPoint"("LogID");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationLogs_LogID_key" ON "EmailVerificationLogs"("LogID");

-- CreateIndex
CREATE UNIQUE INDEX "EnrichmentLogs_LogID_key" ON "EnrichmentLogs"("LogID");

-- CreateIndex
CREATE UNIQUE INDEX "User_UserID_key" ON "User"("UserID");

-- CreateIndex
CREATE UNIQUE INDEX "User_apikey_key" ON "User"("apikey");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "BreakPoint" ADD CONSTRAINT "BreakPoint_LogID_fkey" FOREIGN KEY ("LogID") REFERENCES "EmailVerificationLogs"("LogID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationLogs" ADD CONSTRAINT "EmailVerificationLogs_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("UserID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentLogs" ADD CONSTRAINT "EnrichmentLogs_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("UserID") ON DELETE RESTRICT ON UPDATE CASCADE;
