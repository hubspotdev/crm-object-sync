/// <reference types="jest" />
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
  beforeAll
} from '@jest/globals';
import request from 'supertest';
import { Server } from 'http';
import { app } from '../src/app';
import { prisma } from '../src/clients';
import { syncContactsToHubSpot } from '../src/initialSyncToHubSpot';
import { initialContactsSync } from '../src/initialSyncFromHubSpot';
import { redeemCode, getAccessToken, authUrl } from '../src/auth';
import { getCustomerId } from '../src/utils/utils';

// Mock all external dependencies
jest.mock('../src/clients', () => ({
  prisma: {
    contacts: {
      findMany: jest.fn()
    }
  },
  hubspotClient: {
    oauth: {
      getAuthorizationUrl: jest.fn(),
      defaultApi: {
        createToken: jest.fn()
      }
    }
  }
}));

jest.mock('../src/initialSyncToHubSpot');
jest.mock('../src/initialSyncFromHubSpot');
jest.mock('../src/auth', () => ({
  authUrl: 'https://app.hubspot.com/oauth/authorize?mock=true',
  redeemCode: jest.fn(),
  getAccessToken: jest.fn()
}));
jest.mock('../src/utils/utils');

// Mock environment variables
process.env.HUBSPOT_CLIENT_ID = 'test-client-id';
process.env.HUBSPOT_CLIENT_SECRET = 'test-client-secret';
process.env.HUBSPOT_SCOPE = 'test-scope';
process.env.REDIRECT_URI = 'http://localhost:3000/oauth-callback';

let server: Server;

beforeAll((done) => {
  const port = 3001;
  server = app.listen(port, () => done());
});

afterAll((done) => {
  server?.close(done);
});

describe('Express App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /contacts', () => {
    it('should return contacts successfully', async () => {
      const mockContacts = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Doe', email: 'jane@example.com' }
      ];
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockResolvedValue(mockContacts);

      const response = await request(server).get('/contacts').expect(200);
      expect(response.body).toEqual(mockContacts);
    });

    it('should handle empty contact list', async () => {
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockResolvedValue([]);

      const response = await request(server).get('/contacts').expect(200);
      expect(response.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(server).get('/contacts').expect(500);
      expect(response.body).toEqual({
        message: 'An error occurred while fetching contacts.'
      });
    });
  });

  describe('GET /sync-contacts', () => {
    it('should sync contacts successfully', async () => {
      const mockSyncResults = { success: true, synced: 10, failed: 0 };
      (syncContactsToHubSpot as jest.MockedFunction<any>).mockResolvedValue(mockSyncResults);

      const response = await request(server).get('/sync-contacts').expect(200);
      expect(response.body).toEqual(mockSyncResults);
    });

    it('should handle sync failures', async () => {
      (syncContactsToHubSpot as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Sync failed')
      );

      const response = await request(server).get('/sync-contacts').expect(500);
      expect(response.body).toEqual({
        message: 'An error occurred while syncing contacts.'
      });
    });
  });

  describe('GET /initial-contacts-sync', () => {
    it('should perform initial sync successfully', async () => {
      const mockSyncResults = { imported: 15, skipped: 2, errors: [] };
      (initialContactsSync as jest.MockedFunction<any>).mockResolvedValue(mockSyncResults);

      const response = await request(server).get('/initial-contacts-sync').expect(200);
      expect(response.body).toEqual(mockSyncResults);
    });

    it('should handle initial sync failures', async () => {
      (initialContactsSync as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Sync failed')
      );

      const response = await request(server).get('/initial-contacts-sync').expect(500);
      expect(response.body).toEqual({
        message: 'An error occurred during the initial contacts sync.'
      });
    });

    it('should redirect to install page on 401 error', async () => {
      const error = new Error('Unauthorized');
      (error as any).code = 401;
      (initialContactsSync as jest.MockedFunction<any>).mockRejectedValue(error);

      const response = await request(server).get('/initial-contacts-sync').expect(302);
      expect(response.header.location).toBe('/api/install');
    });

    it('should handle non-401 errors', async () => {
      const error = new Error('Other error');
      (error as any).code = 500;
      (initialContactsSync as jest.MockedFunction<any>).mockRejectedValue(error);

      const response = await request(server).get('/initial-contacts-sync').expect(500);
      expect(response.body).toEqual({
        message: 'An error occurred during the initial contacts sync.'
      });
    });
  });
});
