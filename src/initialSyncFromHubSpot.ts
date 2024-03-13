import 'dotenv/config';

import { Contacts, PrismaClient } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import { getAccessToken } from './auth';
import { getCustomerId } from './utils';

const DEFAULT_LIMITER_OPTIONS = {
  minTime: 1000 / 9,
  maxConcurrent: 6,
  id: 'hubspot-client-limiter'
};

const MAX_BATCH_SIZE = 100;

// Avoid overloading Prisma connections
const prisma = new PrismaClient();

const createOrUpdateContact = async (contactData: any) => {
  let upsertResult: object = {};
  if (contactData.properties.email) {
    // Create the contact if no matching email
    // On matching email, update the HS ID but nothing else
    upsertResult = await prisma.contacts.upsert({
      where:{
        email: contactData.properties.email
      },
      update: { // add the hs ID but don't update anything else
        hs_object_id: contactData.id
      },
      create: {
        email: contactData.properties.email,
        first_name: contactData.properties.firstname,
        last_name: contactData.properties.lastname,
        hs_object_id: contactData.id
      }
    });
    console.log("individual:", upsertResult);
  } else {
    // no email, skip contact for now
    upsertResult = {"skippedId":contactData.id};
  }
    return upsertResult;
}

const initialContactsSync = async () => {
  console.log("started sync");
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  const hubspotClient = new Client({
    accessToken,
    limiterOptions: DEFAULT_LIMITER_OPTIONS
  });
  
  const allContactsResponse = await hubspotClient.crm.contacts.getAll(
    MAX_BATCH_SIZE,                       // limit
    undefined,                            // after
    ['firstname', 'lastname', 'email'],   // properties
    undefined,                            // propertiesWithHistory
    undefined,                            // associations
    false                                 // archived
  );

  console.log(`Found ${allContactsResponse.length} contacts`);

  let upsertResults: Array<object> = [];

  for (const element of allContactsResponse) {
    const createOrUpdateContactResult = await createOrUpdateContact(element);
    upsertResults.push(createOrUpdateContactResult);
  }

  console.log("all results:",upsertResults);

  return(upsertResults);
}

export {initialContactsSync};