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
  // Find a free port
  const port = 3001; // or any other port different from 3000
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
        console.error('Error closing server:', err);
        done(err);
      } else {
        console.log('Test server closed successfully');
        done();
      }
    });
  } else {
    done();
  }
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
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockResolvedValue(
        mockContacts
      );

      const response = await request(server).get('/contacts').expect(200);

      expect(response.body).toEqual(mockContacts);
    });

    it('should handle empty contact list', async () => {
      (prisma.contacts.findMany as jest.MockedFunction<any>).mockResolvedValue(
        []
      );

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

  describe('GET /api/install', () => {
    const mockUrl = 'https://app.hubspot.com/oauth/authorize?mock=true';

    it('should return installation URL', async () => {
      const response = await request(server).get('/api/install').expect(200);

      expect(response.text).toContain(mockUrl);
      expect(response.text).toMatch(
        /<html>.*<body>.*<a.*>.*<\/a>.*<\/body>.*<\/html>/
      );
    });
  });

  describe('GET /sync-contacts', () => {
    it('should sync contacts successfully', async () => {
      const mockSyncResults = {
        success: true,
        synced: 10,
        failed: 0
      };
      (syncContactsToHubSpot as jest.MockedFunction<any>).mockResolvedValue(
        mockSyncResults
      );

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

  describe('GET /', () => {
    it('should return access token successfully', async () => {
      const mockCustomerId = 'test-customer';
      const mockAccessToken = 'valid-access-token';
      (getCustomerId as jest.Mock).mockReturnValue(mockCustomerId);
      (getAccessToken as jest.MockedFunction<any>).mockResolvedValue(
        mockAccessToken
      );

      const response = await request(server).get('/').expect(200);

      expect(response.text).toBe(mockAccessToken);
    });

    it('should handle token retrieval errors', async () => {
      (getCustomerId as jest.Mock).mockReturnValue('test-customer');
      (getAccessToken as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Token retrieval failed')
      );

      const response = await request(server).get('/').expect(500);

      expect(response.body).toEqual({
        message: 'An error occurred while fetching the access token.'
      });
    });
  });

  describe('GET /oauth-callback', () => {
    it('should handle valid code and redirect', async () => {
      const mockAuthInfo = {
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        hubId: 'test-hub-id',
        portalId: 'test-hub-id'
      };
      (redeemCode as jest.MockedFunction<any>).mockResolvedValue(mockAuthInfo);

      const response = await request(server)
        .get('/oauth-callback')
        .query({ code: 'valid-code' })
        .expect(302);

      expect(response.header.location).toMatch(/^http:\/\/localhost:/);
    });

    it('should handle missing code parameter', async () => {
      const response = await request(server).get('/oauth-callback').expect(400);

      expect(response.body).toEqual({
        message: 'Code parameter is missing in the query string.'
      });
    });

    it('should handle code redemption errors', async () => {
      (redeemCode as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Invalid code')
      );

      const response = await request(server)
        .get('/oauth-callback')
        .query({ code: 'invalid-code' })
        .expect(302);

      expect(response.header.location).toMatch(/errMessage=Invalid%20code/);
    });
  });

  describe('GET /initial-contacts-sync', () => {
    it('should perform initial sync successfully', async () => {
      const mockSyncResults = {
        imported: 15,
        skipped: 2,
        errors: []
      };
      (initialContactsSync as jest.MockedFunction<any>).mockResolvedValue(
        mockSyncResults
      );

      const response = await request(server)
        .get('/initial-contacts-sync')
        .expect(200);

      expect(response.body).toEqual(mockSyncResults);
    });

    it('should handle sync errors', async () => {
      (initialContactsSync as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Sync failed')
      );

      const response = await request(server)
        .get('/initial-contacts-sync')
        .expect(500);

      expect(response.body).toEqual({
        message: 'An error occurred during the initial contacts sync.'
      });
    });
  });
});
