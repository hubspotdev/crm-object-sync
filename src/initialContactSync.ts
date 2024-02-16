import 'dotenv/config';

import { Contacts, PrismaClient } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import { exchangeForTokens, getAccessToken } from './auth';
import { getCustomerId } from './utils';
import {
  BatchReadInputSimplePublicObjectId,
  SimplePublicObjectInput
} from '@hubspot/api-client/lib/codegen/crm/contacts';
import { read } from 'fs';
import { BatchResponseSimplePublicObject } from '@hubspot/api-client/lib/codegen/crm/companies';

const DEFAULT_LIMITER_OPTIONS = {
  minTime: 1000 / 9,
  maxConcurrent: 6,
  id: 'hubspot-client-limiter'
};

const MAX_BATCH_SIZE = 100;

const splitBatchByMaxBatchSize = (contacts: Contacts[], start: number) => {
  return contacts.splice(start, MAX_BATCH_SIZE);
};

const filterBatchRecordsByPreviouslySynced = (
  batch: Contacts[],
  syncedContacts: BatchResponseSimplePublicObject
) => {
  const unSyncedBatch = batch.filter((contact) => {
    const matchedContact = syncedContacts?.results.find((syncedContact) => {
      syncedContact.id == String(contact.id);
    });
    if (!matchedContact) {
      return false;
    }
    return matchedContact;
  });
  return unSyncedBatch;
};

const removeNullValues = (rawInput: {
  email: string | null;
  firstname: string | null;
  lastname: string | null;
}) => {
  const cleanedInput: SimplePublicObjectInput = { properties: {} };
  for (const [k, v] of Object.entries(rawInput)) {
    if (v) {
      cleanedInput.properties[k] = v;
    }
  }
  return cleanedInput;
};

const formatBatchForSendToHubSpot = (
  batch: Contacts[]
): SimplePublicObjectInput[] => {
  return batch.map((contact) => {
    const rawInput = {
      email: contact.email,
      firstname: contact.first_name,
      lastname: contact.last_name
    };
    return removeNullValues(rawInput);
  });
};

const syncContactsToHubSpot = async () => {
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  const hubspotClient = new Client({
    accessToken,
    limiterOptions: DEFAULT_LIMITER_OPTIONS
  });
  const prisma = new PrismaClient();
  const localContacts = await prisma.contacts.findMany({
    where: { hs_object_id: null }
  });
  const syncJob = await prisma.syncJobs.create({
    data: { executionTime: new Date() }
  });
  //console.log('localContacts', localContacts);
  let start = 0;
  let finalResults: any[] = [];
  let finalErrors: any[] = [];
  const syncJobId = syncJob.id;
  while (localContacts.length > 0) {
    let batch = splitBatchByMaxBatchSize(localContacts, start);
    // Check if any contacts already exist in HubSpot
    const syncedContacts = await batchReadByEmail(batch);
    if (!syncedContacts) {
      continue;
    }
    console.log('syncedContacts lenght', syncedContacts?.results.length ?? 0);
    batch =
      syncedContacts?.results.length ?? 0 == 0
        ? batch
        : filterBatchRecordsByPreviouslySynced(batch, syncedContacts);
    const formattedBatch = formatBatchForSendToHubSpot(batch);
    console.log('Attempting to send to HubSpot');
    try {
      const results = await hubspotClient.crm.contacts.batchApi.create({
        inputs: formattedBatch
      });
      finalResults = finalResults.concat(results);
      localContacts.splice(start, MAX_BATCH_SIZE);
      start += MAX_BATCH_SIZE;
      continue;
    } catch (error) {
      finalErrors.push({ error, batch });
      continue;
    }
  }
  await prisma.syncJobs.update({
    where: { id: syncJobId },
    data: { success: finalResults, failures: finalErrors }
  });

  console.log('local contacts after splice');
  console.log(localContacts.length);
  return { results: { success: finalResults, errors: finalErrors } };
};
interface ContactWithEmail extends Contacts {
  email: string;
}

const batchReadByEmail = async (batch: Contacts[]) => {
  console.log('batchReadByEmail');
  console.log('batch size: ', batch.length);
  const customerId = getCustomerId();
  const accessToken = await getAccessToken(customerId);
  const hubspotClient = new Client({
    accessToken,
    limiterOptions: DEFAULT_LIMITER_OPTIONS
  });
  const inputsWithEmails: ContactWithEmail[] = batch.filter(
    (contact): contact is ContactWithEmail => !!contact.email
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
  try {
    const readResults = await hubspotClient.crm.contacts.batchApi.read(inputs);
    return readResults;
  } catch (error) {
    console.log(error);
  }
};

export { syncContactsToHubSpot, batchReadByEmail };
