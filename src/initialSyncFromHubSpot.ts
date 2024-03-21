import 'dotenv/config';

import { Contacts, PrismaClient } from '@prisma/client';
import { Client as HubSpotClient } from '@hubspot/api-client';
import { SimplePublicObject } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { getAccessToken } from './auth';
import { getCustomerId } from './utils';

type CreateUpdateUpsertResult = {
  resultRecord: Contacts,
  updateResult: string,
};

// HubSpot Client arguments
// Unused values must be undefined to avoid HubSpot client errors 
const pageLimit: number = 100;
let after: string;
const propertiesToGet: string[]= ['firstname', 'lastname', 'email'];
let propertiesToGetWithHistory: string[];
let associationsToGet: string[];
const getArchived: boolean = false;

// Use verbose (but slower) create or update functionality
const useVerboseCreateOrUpdate: boolean = false;

const DEFAULT_LIMITER_OPTIONS = {
  minTime: 1000 / 9,
  maxConcurrent: 6,
  id: 'hubspot-client-limiter'
};

// Avoid overloading Prisma connections
const prisma = new PrismaClient();

const upsertContact = async (contactData: SimplePublicObject) => {
  let upsertRecord: Contacts;
  let upsertResult: string;
  if (contactData.properties.email) {
    // Create the contact if no matching email
    // On matching email, update the HS ID but nothing else
    upsertRecord = await prisma.contacts.upsert({
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
    upsertResult = "upsert";
  } else {
    // no email, create without email
    upsertRecord = await prisma.contacts.create({
      data: {
        first_name: contactData.properties.firstname,
        last_name: contactData.properties.lastname,
        hs_object_id: contactData.id
      }
    });
    upsertResult = "created";
  }
    let result: CreateUpdateUpsertResult = {
      resultRecord: upsertRecord,
      updateResult: upsertResult
    };

    return result;
}

const verboseCreateOrUpdate = async (contactData: SimplePublicObject) => {
  let prismaRecord: Contacts;
  let updateResult: string;

  let result: CreateUpdateUpsertResult = {
    resultRecord: prismaRecord,
    updateResult: updateResult
  }
}

const initialContactsSync = async () => {
  console.log("started sync");
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  const hubspotClient = new HubSpotClient({
    accessToken,
    limiterOptions: DEFAULT_LIMITER_OPTIONS
  });
  
  // Get contacts using client
  const allContactsResponse: SimplePublicObject[] = await hubspotClient.crm.contacts.getAll(
    pageLimit,
    after,
    propertiesToGet,
    propertiesToGetWithHistory,
    associationsToGet,
    getArchived,
  );

  console.log(`Found ${allContactsResponse.length} contacts`);

  let upsertResults: CreateUpdateUpsertResult[] = [];

  for (const element of allContactsResponse) {
    let createOrUpdateContactResult: CreateUpdateUpsertResult;
    if (useVerboseCreateOrUpdate){
      break;

    } else {
      createOrUpdateContactResult = await upsertContact(element);
    }
    upsertResults.push(createOrUpdateContactResult);
  }

  return({
    total: allContactsResponse.length,
    results:upsertResults
  });
}

export {initialContactsSync};
