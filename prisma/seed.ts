import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    await prisma.contacts.create({
        data: {
           first_name: "Jurgen",
           last_name: "Klopp", 
           email: "jklopp@liverpool.com",
           hs_object_id: "202751"
        }
    })
    console.log("seeding");

}
main()
.catch(e => {
    console.error(e);
    process.exit(1);
})
.finally(async () => {
    await prisma.$disconnect();
});

