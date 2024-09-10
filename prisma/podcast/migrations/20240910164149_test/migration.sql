-- CreateTable
CREATE TABLE "SavedProfiles" (
    "id" TEXT NOT NULL,
    "UserID" TEXT NOT NULL,
    "email" TEXT,
    "title" TEXT,
    "sentiment" INTEGER,
    "authorName" TEXT,
    "rank" INTEGER,
    "audience" INTEGER,
    "adCost" INTEGER,
    "host" TEXT,
    "category" TEXT,
    "language" TEXT,
    "episodes" INTEGER,
    "lastedPublished" TEXT,
    "publishingFrequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProfiles_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "SavedProfiles_id_key" ON "SavedProfiles"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_UserID_key" ON "User"("UserID");

-- CreateIndex
CREATE UNIQUE INDEX "User_apikey_key" ON "User"("apikey");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "SavedProfiles" ADD CONSTRAINT "SavedProfiles_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "User"("UserID") ON DELETE RESTRICT ON UPDATE CASCADE;
