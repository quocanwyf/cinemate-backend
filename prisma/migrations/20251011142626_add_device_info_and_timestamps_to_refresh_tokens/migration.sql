/*
  Warnings:

  - Added the required column `updated_at` to the `UserRefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserRefreshToken" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "device_info" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
