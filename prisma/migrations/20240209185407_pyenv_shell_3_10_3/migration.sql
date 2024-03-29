-- CreateTable
CREATE TABLE "SyncJobs" (
    "id" SERIAL NOT NULL,
    "executionTime" TIMESTAMP NOT NULL,
    "success" JSON NOT NULL,
    "failures" JSON NOT NULL,

    CONSTRAINT "SyncJobs_pkey" PRIMARY KEY ("id")
);
