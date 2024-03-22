import 'dotenv/config';

import { Contacts, PrismaClient, Prisma } from '@prisma/client';
import { Client as HubSpotClient } from '@hubspot/api-client';
import { SimplePublicObject } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { getAccessToken } from './auth';
import { getCustomerId } from './utils';

// Use verbose (but slower) create or update functionality
const useVerboseCreateOrUpdate: boolean = false;

// HubSpot client rate limit settings
const DEFAULT_LIMITER_OPTIONS = {
  minTime: 1000 / 9,
  maxConcurrent: 6,
  id: 'hubspot-client-limiter'
};

// HubSpot Client arguments
// Unused values must be undefined to avoid HubSpot client errors 
const pageLimit: number = 100;
let after: string;
const propertiesToGet: string[]= ['firstname', 'lastname', 'email'];
let propertiesToGetWithHistory: string[];
let associationsToGet: string[];
const getArchived: boolean = false;

// Types for handling create/update results
type CreateUpdateUpsertResult = {
  resultRecord: Contacts,
  updateResult: string,
};

type JobRunResults = {
  upsert: number,
  created: number,
  failed: number,
  hsID_updated: number,
  errors: number
};

// Avoid overloading Prisma connections
const prisma = new PrismaClient();

// Update function 1 - use upsert to create or update records
// Faster but less verbose tracking of created vs. updated
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

// Update function 2 - Try to create the record, fall back to update if that fails
// Slower and will result in DB errors, but explicit tracking of created
const verboseCreateOrUpdate = async (contactData: SimplePublicObject) => {
  let prismaRecord: Contacts;
  let updateResult: string;

  try {
    prismaRecord = await prisma.contacts.create({
      data: {
        email: contactData.properties.email,
        first_name: contactData.properties.firstname,
        last_name: contactData.properties.lastname,
        hs_object_id: contactData.id
      }
    });
    updateResult = "created";
  } catch (error) {
    console.log(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError ){
      if (error.code === "P2002") {
        // failed on unique property (i.e. email)
        // Update  existing record by email, just add HS record id to record
        prismaRecord = await prisma.contacts.update({
          where:{
            email: contactData.properties.email
          },
          data: { // add the hs ID but don't update anything else
            hs_object_id: contactData.id
          }
        });
        updateResult = "hsID_updated"
      } else { // some other known error but not existing email
        prismaRecord = {
          id: -1,
          email: contactData.properties.email,
          first_name: contactData.properties.firstname,
          last_name: contactData.properties.lastname,
          hs_object_id: contactData.id
        }
        updateResult = error.code; // log Prisma error code, will be tracked as error in results
      }
    } else {  // Any other failed create result
      prismaRecord = {
        id: -1,
        email: contactData.properties.email,
        first_name: contactData.properties.firstname,
        last_name: contactData.properties.lastname,
        hs_object_id: contactData.id
      }
      updateResult = "failed";
    }
  }

  let result: CreateUpdateUpsertResult = {
    resultRecord: prismaRecord,
    updateResult: updateResult
  }
  return result;
}

// Initial sync FROM HubSpot contacts TO (local) database
const initialContactsSync = async () => {
  console.log("started sync");
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  const hubspotClient = new HubSpotClient({
    accessToken,
    limiterOptions: DEFAULT_LIMITER_OPTIONS
  });

  // Track created/updated/upserted/any errors
  let jobRunResults : JobRunResults = {
    upsert: 0,
    created: 0,
    failed: 0,
    hsID_updated: 0,
    errors: 0
  };

  // Get all contacts using client
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
      createOrUpdateContactResult = await verboseCreateOrUpdate(element);
    } else {
      createOrUpdateContactResult = await upsertContact(element);
    }
    upsertResults.push(createOrUpdateContactResult);
    // Update result counts
    switch (createOrUpdateContactResult.updateResult) {
      case "upsert":
        jobRunResults.upsert += 1;
        break;
      case "created":
        jobRunResults.created += 1;
        break;
      case "hsID_updated":
        jobRunResults.hsID_updated += 1;
        break;
      case "failed":
        jobRunResults.failed += 1;
        break;
      default:
        jobRunResults.errors += 1;
        break;
    }
  }

  return({
    total: allContactsResponse.length,
    resultsCounts: jobRunResults,
    results:upsertResults
  });
}

export {initialContactsSync};
