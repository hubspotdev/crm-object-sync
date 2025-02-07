import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/*Create dataset, mapping over an array*/
const data: Prisma.ContactsCreateManyInput[] = Array.from({ length: 1000 }).map(
  () => ({
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),

    email: faker.internet.email().toLowerCase() //normalize before adding to db
  })
);

/*Run seed command and the function below inserts data in the database*/
async function main() {
  console.log(`=== Generated ${data.length} contacts ===`);
  await prisma.contacts.createMany({
    data,
    skipDuplicates: true // fakerjs will repeat emails
  });
}

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

export { main }; // Export the main function instead
export default prisma;
