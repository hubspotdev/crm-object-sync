import 'dotenv/config';

import { Contacts, Prisma } from '@prisma/client';

import { SimplePublicObject } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { getAccessToken } from './auth';
import { hubspotClient, prisma } from './clients';

import { getCustomerId } from './utils/utils';
import { logger } from './utils/logger';

// Use verbose (but slower) create or update functionality
const useVerboseCreateOrUpdate: boolean = false;

// HubSpot client rate limit settings

// HubSpot Client arguments
// Unused values must be undefined to avoid HubSpot client errors
const pageLimit: number = 100;
let after: string;
const propertiesToGet: string[] = ['firstname', 'lastname', 'email'];
let propertiesToGetWithHistory: string[];
let associationsToGet: string[];
const getArchived: boolean = false;

// Types for handling create/update results
type CreateUpdateUpsertResult = {
  recordDetails: Contacts;
  updateResult: string;
};

type JobRunResults = {
  upsert: {
    count: number;
    records: CreateUpdateUpsertResult[];
  };
  created: {
    count: number;
    records: CreateUpdateUpsertResult[];
  };
  failed: {
    count: number;
    records: CreateUpdateUpsertResult[];
  };
  hsID_updated: {
    count: number;
    records: CreateUpdateUpsertResult[];
  };
  errors: {
    count: number;
    records: CreateUpdateUpsertResult[];
  };
};

interface ContactsWithEmail extends SimplePublicObject {
  properties: { email: string };
}
// Update function 1 - use upsert to create or update records
// Faster but less verbose tracking of created vs. updated
const upsertContact = async (contactData: SimplePublicObject) => {
  let upsertRecord: Contacts;
  let upsertResult: string;
  if (contactData.properties.email) {
    // Create the contact if no matching email
    // On matching email, update the HS ID but nothing else
    upsertRecord = await prisma.contacts.upsert({
      where: {
        email: contactData.properties.email
      },
      update: {
        // add the hs ID but don't update anything else
        hs_object_id: contactData.id
      },
      create: {
        email: contactData.properties.email,
        first_name: contactData.properties.firstname,
        last_name: contactData.properties.lastname,
        hs_object_id: contactData.id
      }
    });
    upsertResult = 'upsert';
  } else {
    // no email, create without email
    upsertRecord = await prisma.contacts.create({
      data: {
        first_name: contactData.properties.firstname,
        last_name: contactData.properties.lastname,
        hs_object_id: contactData.id
      }
    });
    upsertResult = 'created';
  }
  let result: CreateUpdateUpsertResult = {
    recordDetails: upsertRecord,
    updateResult: upsertResult
  };

  return result;
};

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
    updateResult = 'created';
  } catch (error) {

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const contactDataWithEmail = contactData as ContactsWithEmail; // Tell TS we always have an email address in this case
        // failed on unique property (i.e. email)
        // Update  existing record by email, just add HS record id to record
        prismaRecord = await prisma.contacts.update({
          where: {
            email: contactDataWithEmail.properties.email
          },
          data: {
            // add the hs ID but don't update anything else
            hs_object_id: contactData.id
          }
        });
        updateResult = 'hsID_updated';
      } else {
        // some other known error but not existing email
        prismaRecord = {
          id: -1,
          email: contactData.properties.email,
          first_name: contactData.properties.firstname,
          last_name: contactData.properties.lastname,
          hs_object_id: contactData.id
        };
        updateResult = error.code; // log Prisma error code, will be tracked as error in results
      }
    } else {
      // Any other failed create result
      prismaRecord = {
        id: -1,
        email: contactData.properties.email,
        first_name: contactData.properties.firstname,
        last_name: contactData.properties.lastname,
        hs_object_id: contactData.id
      };
      updateResult = 'failed';
    }
  }

  let result: CreateUpdateUpsertResult = {
    recordDetails: prismaRecord,
    updateResult: updateResult
  };
  return result;
};

// Initial sync FROM HubSpot contacts TO (local) database
const initialContactsSync = async (useVerboseCreateOrUpdate: boolean) => {
  useVerboseCreateOrUpdate = useVerboseCreateOrUpdate || false;
  logger.info({
    type: 'HubSpot',
    logMessage: {
      message: 'Started sync'
    }
  });
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  hubspotClient.setAccessToken(accessToken);
  // Track created/updated/upserted/any errors
  let jobRunResults: JobRunResults = {
    upsert: {
      count: 0,
      records: []
    },
    created: {
      count: 0,
      records: []
    },
    failed: {
      count: 0,
      records: []
    },
    hsID_updated: {
      count: 0,
      records: []
    },
    errors: {
      count: 0,
      records: []
    }
  };

  // Get all contacts using client
  const allContactsResponse: SimplePublicObject[] =
    await hubspotClient.crm.contacts.getAll(
      pageLimit,
      after,
      propertiesToGet,
      propertiesToGetWithHistory,
      associationsToGet,
      getArchived
    );

  console.log(`Found ${allContactsResponse.length} contacts`);

  for (const element of allContactsResponse) {
    let createOrUpdateContactResult: CreateUpdateUpsertResult;
    if (useVerboseCreateOrUpdate) {
      createOrUpdateContactResult = await verboseCreateOrUpdate(element);
    } else {
      createOrUpdateContactResult = await upsertContact(element);
    }
    // Add to overall results based on result of create/update result
    switch (createOrUpdateContactResult.updateResult) {
      case 'upsert':
        jobRunResults.upsert.count += 1;
        jobRunResults.upsert.records.push(createOrUpdateContactResult);
        break;
      case 'created':
        jobRunResults.created.count += 1;
        jobRunResults.created.records.push(createOrUpdateContactResult);
        break;
      case 'hsID_updated':
        jobRunResults.hsID_updated.count += 1;
        jobRunResults.hsID_updated.records.push(createOrUpdateContactResult);
        break;
      case 'failed':
        jobRunResults.failed.count += 1;
        jobRunResults.failed.records.push(createOrUpdateContactResult);
        break;
      default:
        jobRunResults.errors.count += 1;
        jobRunResults.errors.records.push(createOrUpdateContactResult);
        break;
    }
  }

  return {
    total: allContactsResponse.length,
    results: jobRunResults
  };
};

export { initialContactsSync };
