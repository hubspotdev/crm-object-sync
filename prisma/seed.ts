import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

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
const data: Prisma.ContactsCreateManyInput[] = Array.from({ length: 1000 }).map(
  () => ({
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    email: faker.internet.email().toLowerCase()
  })
);

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
