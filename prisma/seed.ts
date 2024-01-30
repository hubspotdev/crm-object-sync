import {faker} from '@faker-js/faker';
import { PrismaClient } from "@prisma/client";


/*Create dataset, mapping over an array*/

const data = Array.from({ length:100 }).map(() => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),

}));

const prisma = new PrismaClient();

/*Run seed command and the function below inserts data in the database*/

async function main(){
    await prisma.contacts.createMany({
        data
    });
}

main()
.catch((e) => {
    console.log(e);
    process.exit(1)
})
.finally(() => {
    prisma.$disconnect();
})
 



