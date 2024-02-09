"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const faker_1 = require("@faker-js/faker");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// async function main() {
//     for(let contact of contacts) {
//         await prisma.contacts.create({
//             data: contact
//         })
//     }
// }
// main().catch(e => {
//     console.log(e);
//     process.exit(1)
//     }).finally(() => {
//         prisma.$disconnect();
//     }) 
/*Create dataset, mapping over an array*/
const data = Array.from({ length: 100 }).map(() => ({
    first_name: faker_1.faker.person.firstName(),
    last_name: faker_1.faker.person.lastName(),
    email: faker_1.faker.internet.email()
}));
/*Run seed command and the function below inserts data in the database*/
async function main() {
    console.log(data);
    await prisma.contacts.createMany({
        data
    });
}
main()
    .catch((e) => {
    console.log(e);
    process.exit(1);
})
    .finally(() => {
    prisma.$disconnect();
});
