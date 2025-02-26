import { apiEndpoints, commonSchemas } from './swagger/definitions';
import { PORT } from './utils/utils';
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HubSpot Contact Sync API',
      version: '1.0.0',
      description:
        'API for syncing and managing contacts between the local database and HubSpot'
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local development server'
      }
    ],
    components: {
      schemas: commonSchemas
    },
    paths: apiEndpoints
  },
  apis: ['./src/app.ts'] // Since all routes are in app.ts
};

const specs = swaggerJsdoc(options);

export { specs };
