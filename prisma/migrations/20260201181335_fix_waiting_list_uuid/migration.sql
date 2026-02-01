/*
  Warnings:

  - The primary key for the `waiting_list` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `waiting_list` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "waiting_list" DROP CONSTRAINT "waiting_list_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "waiting_list_pkey" PRIMARY KEY ("id");
