-- CreateTable
CREATE TABLE "Contacts" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "hs_object_id" TEXT NOT NULL,

    CONSTRAINT "Contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Companies" (
    "id" SERIAL NOT NULL,
    "domain" TEXT,
    "name" TEXT,
    "hs_object_id" TEXT NOT NULL,

    CONSTRAINT "Companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Authorization" (
    "customerId" VARCHAR(255) NOT NULL,
    "hsPortalId" VARCHAR(255) NOT NULL,
    "accessToken" VARCHAR(255) NOT NULL,
    "refreshToken" VARCHAR(255) NOT NULL,
    "expiresIn" INTEGER,
    "expiresAt" TIMESTAMP(6),

    CONSTRAINT "Authorization_pkey" PRIMARY KEY ("customerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contacts_email_key" ON "Contacts"("email");

-- CreateIndex
CREATE INDEX "Contacts_hs_object_id_idx" ON "Contacts"("hs_object_id");

-- CreateIndex
CREATE INDEX "Companies_hs_object_id_idx" ON "Companies"("hs_object_id");
