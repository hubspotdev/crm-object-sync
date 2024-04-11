import { PrismaClient } from '@prisma/client';
import { Client } from '@hubspot/api-client';

const DEFAULT_LIMITER_OPTIONS = {
  minTime: 1000 / 9,
  maxConcurrent: 6,
  id: 'hubspot-client-limiter'
};

export const prisma = new PrismaClient();

export const hubspotClient = new Client({
  limiterOptions: DEFAULT_LIMITER_OPTIONS
});
