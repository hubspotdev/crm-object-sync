import 'dotenv/config';

import { Contacts, PrismaClient } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import { exchangeForTokens, getAccessToken } from './auth';
import { getCustomerId } from './utils';
import {
  BatchReadInputSimplePublicObjectId,
  BatchResponseSimplePublicObjectStatusEnum,
  SimplePublicObjectBatchInput,
  SimplePublicObjectInputForCreate,
  BatchResponseSimplePublicObjectWithErrors,
  BatchResponseSimplePublicObject
} from '@hubspot/api-client/lib/codegen/crm/contacts';
import prisma from '../prisma';

interface KeyedContacts extends Contacts {
  [key: string]: any;
}

const DEFAULT_LIMITER_OPTIONS = {
  minTime: 1000 / 9,
  maxConcurrent: 6,
  id: 'hubspot-client-limiter'
};
const customerId = getCustomerId();

const hubspotClient = new Client({
  limiterOptions: DEFAULT_LIMITER_OPTIONS
});

const MAX_BATCH_SIZE = 100;

const splitBatchByMaxBatchSize = (contacts: Contacts[], start: number) => {
  return contacts.splice(start, MAX_BATCH_SIZE);
};

interface ContactWithEmail extends Contacts {
  email: string;
}

class BatchToBeSynced {
  startingContacts: Contacts[] = [];
  batchSize: number = 0;
  nativeIdsToRemoveFromBatchBeforeCreateAttempt = [];
  mapOfEmailsToNativeIds: Map<string, number> = new Map(); // might want to make this a private property
  #batchReadInputs: BatchReadInputSimplePublicObjectId = {
    properties: [''],
    propertiesWithHistory: [''],
    inputs: []
  };
  #batchReadOutput:
    | BatchResponseSimplePublicObject
    | BatchResponseSimplePublicObjectWithErrors = {
    status: BatchResponseSimplePublicObjectStatusEnum.Pending,
    results: [],
    startedAt: new Date(),
    completedAt: new Date()
  };
  #batchCreateOutput:
    | BatchResponseSimplePublicObject
    | BatchResponseSimplePublicObjectWithErrors = {
    status: BatchResponseSimplePublicObjectStatusEnum.Pending,
    results: [],
    startedAt: new Date(),
    completedAt: new Date()
  };
  hubspotClient: Client;
  constructor(startingContacts: Contacts[], hubspotClient: Client) {
    this.hubspotClient = hubspotClient;
    this.startingContacts = startingContacts;
    this.batchSize = this.startingContacts.length;
    if (!this.isLessThanMaxBatchSize()) {
      throw new Error(
        `Batch is too big, please supply less than ${MAX_BATCH_SIZE} `
      );
    }
  }
  isLessThanMaxBatchSize() {
    return this.startingContacts.length <= MAX_BATCH_SIZE;
  }

  createMapOfEmailsToNativeIds() {
    //this.mapOfEmailsToNativeIds = new Map();
    // Use for of loop to impreove readability
    for (let i = 0; i < this.startingContacts.length; i++) {
      const contact = this.startingContacts[i];
      if (!contact.email) {
        // ignore contacts without email addresses for now
        return false;
      }

      this.mapOfEmailsToNativeIds.set(contact.email, contact.id);
    }
  }

  readyBatchForBatchRead() {
    // Filter out contacts that don't have an email address
    // Consider making this a private method, no real reason for it to be exposed
    const inputsWithEmails: ContactWithEmail[] = this.startingContacts.filter(
      (contact): contact is ContactWithEmail => !!contact.email
    );
    const idsToRead = inputsWithEmails.map((contact) => {
      return { id: contact.email };
    });
    this.#batchReadInputs = {
      inputs: idsToRead,
      idProperty: 'email',
      properties: ['email', 'firstname', 'lastname'],
      propertiesWithHistory: []
    };
  }

  async batchRead() {
    const accessToken = await getAccessToken(customerId);
    this.hubspotClient.setAccessToken(accessToken);
    const response = await this.hubspotClient.crm.contacts.batchApi.read(
      this.#batchReadInputs
    );

    this.#batchReadOutput = response;

    //
  }

  removeKnownContactsFromBatch() {
    const emailsOfKnownContacts = this.#batchReadOutput.results.map(
      (knownContact) => {
        return knownContact.properties.email
          ? knownContact.properties.email
          : '';
      }
    );

    //console.log(emailsOfKnownContacts);
    for (const email of emailsOfKnownContacts) {
      this.mapOfEmailsToNativeIds.delete(email);
    }
  }

  async sendNetNewContactsToHubspot() {
    const contactsToSendToHubSpot: SimplePublicObjectInputForCreate[] = [];
    this.mapOfEmailsToNativeIds.forEach((nativeId, emailAddress) => {
      const matchedContact = this.startingContacts.find(
        (startingContact) => startingContact.email == emailAddress
      );
      const propertiesToSend = ['email', 'firstname', 'lastname'];
      if (!matchedContact) {
        return false;
      }
      const createPropertiesSection = (
        contact: KeyedContacts,
        propertiesToSend: string[]
      ): SimplePublicObjectBatchInput['properties'] => {
        const propertiesSection: SimplePublicObjectInputForCreate['properties'] =
          {};
        for (const property of propertiesToSend) {
          contact[property]
            ? (propertiesSection[property] = contact[property])
            : null;
        }
        return propertiesSection;
      };
      const nonNullPropertiesToSend = createPropertiesSection(
        matchedContact,
        propertiesToSend
      );
      const formattedContact = {
        associations: [],
        properties: nonNullPropertiesToSend
      };

      contactsToSendToHubSpot.push(formattedContact);
    });
    const response = await this.hubspotClient.crm.contacts.batchApi.create({
      inputs: contactsToSendToHubSpot
    });
    this.#batchCreateOutput = response;
    return response;
  }

  async saveHSContactIDToDatabase() {
    if (this.#batchCreateOutput.results.length > 0) {
      const savedContacts = this.#batchCreateOutput.results;
      for (const contact of savedContacts) {
        await prisma.contacts.update({
          where: {
            email: contact.properties.email || ''
          },
          data: {
            hs_object_id: contact.id
          }
        });
      }
    } else {
      const savedContacts = this.#batchReadOutput.results;
      for (const contact of savedContacts) {
        await prisma.contacts.update({
          where: {
            email: contact.properties.email || ''
          },
          data: {
            hs_object_id: contact.id
          }
        });
      }
    }
  }
}

const syncContactsToHubSpot = async () => {
  const prisma = new PrismaClient();
  const localContacts = await prisma.contacts.findMany({
    where: { hs_object_id: null }
  });
  const syncJob = await prisma.syncJobs.create({
    data: { executionTime: new Date() }
  });
  console.log('localContacts', localContacts.length);

  let start = 0;
  let finalResults: any[] = [];
  let finalErrors: any[] = [];
  const syncJobId = syncJob.id;
  while (localContacts.length > 0) {
    let batch = splitBatchByMaxBatchSize(localContacts, start);

    const batchbyClass = new BatchToBeSynced(batch, hubspotClient);
    batchbyClass.createMapOfEmailsToNativeIds();
    batchbyClass.readyBatchForBatchRead();

    await batchbyClass.batchRead();

    batchbyClass.removeKnownContactsFromBatch();

    if (batchbyClass.mapOfEmailsToNativeIds.size === 0) {
      // take the next set of 100 contacts
      console.log('all contacts where known, no need to create');
    } else {
      const syncResults = await batchbyClass.sendNetNewContactsToHubspot();
      console.log(syncResults);
      finalResults.push(await batchbyClass.sendNetNewContactsToHubspot());

      console.log('Finished running');
    }
    await batchbyClass.saveHSContactIDToDatabase();
  }
  await prisma.syncJobs.update({
    where: { id: syncJobId },
    data: { success: finalResults, failures: finalErrors }
  });
  return { results: { success: finalResults, errors: finalErrors } };
};

export { syncContactsToHubSpot };
