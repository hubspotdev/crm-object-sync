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
import { getAccessToken } from '../src/auth';
import { getCustomerId } from '../src/utils/utils';
import shutdown from '../src/utils/shutdown';

// Mock all external dependencies
jest.mock('../src/clients', () => ({
  prisma: {
    contacts: {
      findMany: jest.fn(),
      update: jest.fn()
    },
    syncJobs: {
      create: jest.fn(),
      update: jest.fn()
    }
  },
  hubspotClient: {
    setAccessToken: jest.fn(),
    crm: {
      contacts: {
        getAll: jest.fn(),
        batchApi: {
          read: jest.fn(),
          create: jest.fn()
        }
      }
    },
    apiRequest: jest.fn()
  }
}));

jest.mock('../src/initialSyncToHubSpot');
jest.mock('../src/initialSyncFromHubSpot');
jest.mock('../src/auth', () => ({
  getAccessToken: jest.fn()
}));
jest.mock('../src/utils/utils', () => ({
  getCustomerId: jest.fn(),
  getBooleanFromString: jest.fn().mockImplementation((value: unknown) => String(value) === 'true'),
  PORT: 3001
}));

// Mock environment variables
process.env.OAUTH_SERVICE_URL = 'http://oauth-service:3001';

let server: Server;

beforeAll(done => {
  const port = 3001;
  server = app.listen(port, () => {
    console.log(`Test server running on port ${port}`);
    done();
  });
});

afterAll((done) => {
  if (server) {
    console.log('Closing test server...');
    server.close((err?: Error) => {
      if (err) {
        console.error('Error closing test server:', err);
      }
      done();
    });
  } else {
    done();
  }
}, 10000);

describe('Express App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /contacts', () => {
    it('should return contacts successfully', async () => {
      const mockContacts = [
        { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
        { id: 2, first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }
      ];
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockResolvedValue(
        mockContacts
      );

      const response = await request(server)
        .get('/contacts')
        .expect(200);

      expect(response.body).toEqual(mockContacts);
    });

    it('should handle empty contact list', async () => {
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockResolvedValue(
        []
      );

      const response = await request(server)
        .get('/contacts')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(server)
        .get('/contacts')
        .expect(500);

      expect(response.body).toEqual({
        message: 'An error occurred while fetching contacts.'
      });
    });
  });

  describe('GET /sync-contacts', () => {
    it('should sync contacts successfully', async () => {
      const mockSyncResults = {
        results: {
          success: [{ id: 1, status: 'completed' }],
          errors: []
        }
      };
      (syncContactsToHubSpot as jest.MockedFunction<any>).mockResolvedValue(
        mockSyncResults
      );

      const response = await request(server)
        .get('/sync-contacts')
        .expect(200);

      expect(response.body).toEqual(mockSyncResults);
    });

    it('should handle sync failures', async () => {
      (syncContactsToHubSpot as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Sync failed')
      );

      const response = await request(server)
        .get('/sync-contacts')
        .expect(500);

      expect(response.body).toEqual({
        message: 'An error occurred while syncing contacts.'
      });
    });
  });

  describe('GET /initial-contacts-sync', () => {
    jest.setTimeout(10000);

    it('should perform initial sync successfully', async () => {
      const mockSyncResults = {
        total: 2,
        results: {
          upsert: { count: 1, records: [] },
          created: { count: 1, records: [] },
          failed: { count: 0, records: [] },
          hsID_updated: { count: 0, records: [] },
          errors: { count: 0, records: [] }
        }
      };
      (initialContactsSync as jest.MockedFunction<any>).mockResolvedValue(
        mockSyncResults
      );

      const response = await request(server)
        .get('/initial-contacts-sync')
        .expect(200);

      expect(response.body).toEqual(mockSyncResults);
    });

    it('should handle initial sync failures', async () => {
      (initialContactsSync as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Initial sync failed')
      );

      const response = await request(server)
        .get('/initial-contacts-sync')
        .expect(500);

      expect(response.body).toEqual({
        message: 'An error occurred during the initial contacts sync.'
      });
    });

    it('should redirect to install page on 401 error', async () => {
      const error = new Error('Unauthorized') as any;
      error.code = 401;
      (initialContactsSync as jest.MockedFunction<any>).mockRejectedValue(error);

      const response = await request(server)
        .get('/initial-contacts-sync')
        .expect(302);

      expect(response.headers.location).toBe('http://localhost:3001/install');
    });

    it('should handle non-401 errors', async () => {
      const error = new Error('Some other error') as any;
      error.code = 500;
      (initialContactsSync as jest.MockedFunction<any>).mockRejectedValue(error);

      const response = await request(server)
        .get('/initial-contacts-sync')
        .expect(500);

      expect(response.body).toEqual({
        message: 'An error occurred during the initial contacts sync.'
      });
    });
  });
});
