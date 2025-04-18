import 'dotenv/config';

import { Contacts, PrismaClient } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import { authenticateHubspotClient } from './auth';
import {
  BatchReadInputSimplePublicObjectId,
  BatchResponseSimplePublicObjectStatusEnum,
  SimplePublicObjectInputForCreate,
  BatchResponseSimplePublicObjectWithErrors,
  BatchResponseSimplePublicObject,
  StandardError
} from '@hubspot/api-client/lib/codegen/crm/contacts';
import { prisma, hubspotClient } from './clients';

interface KeyedContacts extends Contacts {
  [key: string]: any;
}

const MAX_BATCH_SIZE = 100;

const splitBatchByMaxBatchSize = (contacts: Contacts[], start: number) => {
  return contacts.splice(start, MAX_BATCH_SIZE);
};

interface ContactWithEmail extends Contacts {
  email: string;
}

class BatchToBeSynced {
  startingContacts: Contacts[] = [];

  cohortSize: number = 0;
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
  #batchReadError: Error | null = null;
  #syncErrors: StandardError[] | null = null;
  #saveErrors: Error[] | null = null;

  hubspotClient: Client;
  constructor(startingContacts: Contacts[], hubspotClient: Client) {
    this.hubspotClient = hubspotClient;
    this.startingContacts = startingContacts;

    this.cohortSize = this.startingContacts.length;

    if (!this.isLessThanMaxBatchSize()) {
      throw new Error(
        `Batch is too big, please supply less than ${MAX_BATCH_SIZE} `
      );
    }

    this.createMapOfEmailsToNativeIds();
    this.readyBatchForBatchRead();
  }
  isLessThanMaxBatchSize() {
    return this.startingContacts.length <= MAX_BATCH_SIZE;
  }

  createMapOfEmailsToNativeIds() {
    // Use for of loop to impreove readability
    for (let i = 0; i < this.startingContacts.length; i++) {
      const contact = this.startingContacts[i];
      if (contact.email) {
        this.mapOfEmailsToNativeIds.set(contact.email, contact.id);
        // ignore contacts without email addresses for now
      }
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
    await authenticateHubspotClient();
    try {
      const response = await this.hubspotClient.crm.contacts.batchApi.read(
        this.#batchReadInputs
      );
      this.#batchReadOutput = response;
    } catch (error) {
      if (error instanceof Error) {
        this.#batchReadError = error;
      }
    }
  }

  removeKnownContactsFromBatch() {
    const emailsOfKnownContacts = this.#batchReadOutput.results.map(
      (knownContact) => {
        return knownContact.properties.email
          ? knownContact.properties.email
          : '';
      }
    );

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

      const propertiesToSend = ['email', 'firstname', 'lastname']; // Make this a DB call to mapped Properties when combined with property mapping use case

      if (!matchedContact) {
        return false;
      }
      const createPropertiesSection = (
        contact: KeyedContacts,
        propertiesToSend: string[]
      ): SimplePublicObjectInputForCreate['properties'] => {
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

    try {
      const response = await this.hubspotClient.crm.contacts.batchApi.create({
        inputs: contactsToSendToHubSpot
      });
      if (
        response instanceof BatchResponseSimplePublicObjectWithErrors &&
        response.errors
      ) {
        if (Array.isArray(this.#syncErrors)) {
          this.#syncErrors.concat(response.errors);
        } else {
          this.#syncErrors = response.errors;
        }
      }
      this.#batchCreateOutput = response;
      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (this.#saveErrors) {
          this.#saveErrors.push(error);
        } else {
          this.#saveErrors = [error];
        }
      }
    }
  }

  async saveHSContactIDToDatabase() {
    const savedContacts = this.#batchCreateOutput.results.length
      ? this.#batchCreateOutput.results
      : this.#batchReadOutput.results;
    for (const contact of savedContacts) {
      try {
        if (!contact.properties.email) {
          throw new Error('Need an email address to save contacts');
        }
        await prisma.contacts.update({
          where: {
            email: contact.properties.email
          },
          data: {
            hs_object_id: contact.id
          }
        });
      } catch (error) {
        throw new Error('Encountered an issue saving a record to the database');
      }
    }
  }

  public get syncErrors() {
    return this.#syncErrors;
  }
  public get saveErrors() {
    return this.#saveErrors;
  }
  public get syncResults() {
    return this.#batchCreateOutput;
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

  let start = 0;
  let finalResults: any[] = [];
  let finalErrors: any[] = [];
  const syncJobId = syncJob.id;

  console.log(
    `===== Starting Sync Job for ${localContacts.length} contacts =====`
  );
  while (localContacts.length > 0) {
    let batch = splitBatchByMaxBatchSize(localContacts, start);

    const syncCohort = new BatchToBeSynced(batch, hubspotClient);

    await syncCohort.batchRead();

    syncCohort.removeKnownContactsFromBatch();

    if (syncCohort.mapOfEmailsToNativeIds.size === 0) {
      // take the next set of 100 contacts
      console.log('all contacts were known, no need to create');
    } else {
      await syncCohort.sendNetNewContactsToHubspot();

      const errors = syncCohort.syncErrors;

      const results = syncCohort.syncResults;
      if (errors) {
        finalErrors.push(errors);
      }

      finalResults.push(results);
      console.log(
        `===== Finished current cohort, still have ${localContacts.length} contacts to sync =====`
      );
    }
    await syncCohort.saveHSContactIDToDatabase();
  }
  await prisma.syncJobs.update({
    where: { id: syncJobId },
    data: { success: finalResults, failures: finalErrors }
  });

  console.log(
    `==== Batch sync complete, this job produced ${finalResults.length} successes and ${finalErrors.length} errors, check the syncJobs table for full results ====`
  );

  return { results: { success: finalResults, errors: finalErrors } };
};

export { syncContactsToHubSpot };
