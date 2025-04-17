import 'dotenv/config';

import { Contacts } from '@prisma/client';
import { Client } from '@hubspot/api-client';
import { getAccessToken } from './auth';
import {
  BatchReadInputSimplePublicObjectId,
  BatchResponseSimplePublicObjectStatusEnum,
  SimplePublicObjectBatchInput,
  SimplePublicObjectInputForCreate,
  BatchResponseSimplePublicObjectWithErrors,
  BatchResponseSimplePublicObject,
  StandardError
} from '@hubspot/api-client/lib/codegen/crm/contacts';
import { prisma, hubspotClient } from './clients';
import { getCustomerId } from './utils/utils';
import { logger } from './utils/logger';

interface KeyedContacts extends Contacts {
  [key: string]: any;
}

const customerId = getCustomerId();

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
    try {
      logger.info({
        type: 'HubSpot',
        context: 'Batch Read',
        logMessage: {
          message: 'Starting batch read from HubSpot',
          data: {
            batchSize: this.cohortSize,
            inputCount: this.#batchReadInputs.inputs.length
          }
        }
      });

      const accessToken = await getAccessToken(customerId);
      this.hubspotClient.setAccessToken(accessToken);

      const response = await this.hubspotClient.crm.contacts.batchApi.read(
        this.#batchReadInputs
      );
      this.#batchReadOutput = response;

      logger.info({
        type: 'HubSpot',
        context: 'Batch Read',
        logMessage: {
          message: 'Successfully completed batch read from HubSpot',
          data: {
            resultsCount: response.results.length
          }
        }
      });
    } catch (error) {
      logger.error({
        type: 'HubSpot',
        context: 'Batch Read',
        logMessage: {
          message: 'Failed to perform batch read from HubSpot',
          stack: error instanceof Error ? error.stack : undefined,
          data: {
            batchSize: this.cohortSize
          }
        }
      });
      if (error instanceof Error) {
        this.#batchReadError = error;
      }
    }
  }

  removeKnownContactsFromBatch() {
    const emailsOfKnownContacts = this.#batchReadOutput.results.map(
      (knownContact: { properties: { email?: string } }) => {
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
    try {
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

      logger.info({
        type: 'HubSpot',
        context: 'Batch Create',
        logMessage: {
          message: 'Starting batch create in HubSpot',
          data: {
            contactCount: contactsToSendToHubSpot.length
          }
        }
      });

      const response = await this.hubspotClient.crm.contacts.batchApi.create({
        inputs: contactsToSendToHubSpot
      });

      if (
        response instanceof BatchResponseSimplePublicObjectWithErrors &&
        response.errors
      ) {
        logger.warn({
          type: 'HubSpot',
          context: 'Batch Create',
          logMessage: {
            message: 'Batch create completed with some errors',
            data: {
              errors: response.errors
            }
          }
        });
        if (Array.isArray(this.#syncErrors)) {
          this.#syncErrors.concat(response.errors);
        } else {
          this.#syncErrors = response.errors;
        }
      } else {
        logger.info({
          type: 'HubSpot',
          context: 'Batch Create',
          logMessage: {
            message: 'Successfully completed batch create in HubSpot',
            data: {
              createdCount: response.results.length
            }
          }
        });
      }
      this.#batchCreateOutput = response;
      return response;
    } catch (error) {
      logger.error({
        type: 'HubSpot',
        context: 'Batch Create',
        logMessage: {
          message: 'Failed to perform batch create in HubSpot',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      if (error instanceof Error) {
        if (this.#saveErrors) {
          this.#saveErrors.push(error);
        } else {
          this.#saveErrors = [error];
        }
      }
      throw error;
    }
  }

  async saveHSContactIDToDatabase() {
    try {
      logger.info({
        type: 'Database',
        context: 'HubSpot ID Update',
        logMessage: {
          message: 'Starting to save HubSpot IDs to database',
          data: {
            contactCount: this.#batchCreateOutput.results.length
          }
        }
      });

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

      logger.info({
        type: 'Database',
        context: 'HubSpot ID Update',
        logMessage: {
          message: 'Successfully saved HubSpot IDs to database'
        }
      });
    } catch (error) {
      logger.error({
        type: 'Database',
        context: 'HubSpot ID Update',
        logMessage: {
          message: 'Failed to save HubSpot IDs to database',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      throw error;
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
  console.log('started sync');
  const accessToken = await getAccessToken(customerId);
  hubspotClient.setAccessToken(accessToken);

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
      console.log('all contacts where known, no need to create');
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
