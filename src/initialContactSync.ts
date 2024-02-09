import 'dotenv/config';

import { Contacts, PrismaClient } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import { exchangeForTokens, getAccessToken } from './auth';
import { getCustomerId } from './utils';
import {
  BatchReadInputSimplePublicObjectId,
  SimplePublicObjectInput
} from '@hubspot/api-client/lib/codegen/crm/contacts';

const syncContactsToHubSpot = async () => {
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  const hubspotClient = new Client({ accessToken });
  const prisma = new PrismaClient();
  const localContacts = await prisma.contacts.findMany({
    where: { hs_object_id: null }
  });
  //console.log('localContacts', localContacts);
  let start = 0;
  let count = 100;
  let finalResults: any[] = [];
  let finalErrors: any[] = [];
  while (localContacts.length > 0) {
    let batch = localContacts.splice(start, count);
    const syncedContacts = await batchReadByEmail(batch);
    if (syncedContacts.results.length > 0) {
      //remove results from batch
      const unSyncedBatch = batch.filter((contact) => {
        const matchedContact = syncedContacts.results.find((syncedContact) => {
          syncedContact.id == String(contact.id);
        });
        if (!matchedContact) {
          return false;
        }
        matchedContact;
      });
      batch = unSyncedBatch;
    }
    const formattedBatch = batch.map((contact) => {
      const rawInput = {
        email: contact.email,
        firstname: contact.first_name,
        lastname: contact.last_name
      };
      const cleanedInput: SimplePublicObjectInput = { properties: {} };
      for (const [k, v] of Object.entries(rawInput)) {
        if (v) {
          cleanedInput.properties[k] = v;
        }
      }
      return cleanedInput;
    });
    //console.log(formattedBatch);
    try {
      const results = await hubspotClient.crm.contacts.batchApi.create({
        inputs: formattedBatch
      });
      finalResults = finalResults.concat(results);
    } catch (error) {
      finalErrors.push({ error, batch });
    }
    start += 100;
  }
  return { results: { success: finalResults, errors: finalErrors } };
};
interface ContactWithEmail extends Contacts {
  email: string;
}

const batchReadByEmail = async (batch: any[]) => {
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  const hubspotClient = new Client({ accessToken });
  const inputsWithEmails: ContactWithEmail[] = batch.filter(
    (contact) => !!contact.email
  );
  const idsToRead = inputsWithEmails.map((contact) => {
    return { id: contact.email };
  });

  const inputs: BatchReadInputSimplePublicObjectId = {
    idProperty: 'email',
    inputs: idsToRead,
    properties: [],
    propertiesWithHistory: []
  };
  const readResults = await hubspotClient.crm.contacts.batchApi.read(inputs);
  return readResults;
};

export { syncContactsToHubSpot, batchReadByEmail };
