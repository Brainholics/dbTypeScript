-- CreateTable
CREATE TABLE "Logs" (
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

    CONSTRAINT "Logs_pkey" PRIMARY KEY ("LogID")
);

-- CreateTable
CREATE TABLE "User" (
    "UserID" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "phoneNumber" TEXT,
    "location" TEXT,
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
CREATE UNIQUE INDEX "Logs_LogID_key" ON "Logs"("LogID");

-- CreateIndex
CREATE UNIQUE INDEX "User_UserID_key" ON "User"("UserID");

-- CreateIndex
CREATE UNIQUE INDEX "User_apikey_key" ON "User"("apikey");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("UserID") ON DELETE RESTRICT ON UPDATE CASCADE;
