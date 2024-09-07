/*
  Warnings:

  - You are about to drop the `Logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Logs" DROP CONSTRAINT "Logs_userID_fkey";

-- DropTable
DROP TABLE "Logs";
