"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const faker_1 = require("@faker-js/faker");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/*Create dataset, mapping over an array*/
const data = Array.from({ length: 1000 }).map(() => ({
    first_name: faker_1.faker.person.firstName(),
    last_name: faker_1.faker.person.lastName(),
    email: faker_1.faker.internet.email().toLowerCase() //normalize before adding to db
}));
/*Run seed command and the function below inserts data in the database*/
async function main() {
    console.log(`=== Generated ${data.length} contacts ===`);
    await prisma.contacts.createMany({
        data,
        skipDuplicates: true // fakerjs will repeat emails
    });
}
exports.main = main;
// Only run if this file is being executed directly
if (require.main === module) {
    main()
        .catch((e) => {
        console.error(e);
        process.exit(1);
    })
        .finally(async () => {
        await prisma.$disconnect();
    });
}
exports.default = prisma;
