# CRM Object Sync

A demonstration of best integration practices for syncing CRM contact records between HubSpot and external applications for product management use cases.

## Table of Contents

- [What this project does](#what-this-project-does)
- [Why is this project useful?](#why-is-this-project-useful)
- [Setup](#setup)
- [Scopes](#scopes)
- [Endpoints](#endpoints)
  - [Authentication](#authentication)
  - [Contact Management](#contact-management)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Dependencies](#dependencies)
  - [Core](#core)
  - [Development](#development)
- [Where to get help?](#where-to-get-help)
- [Who maintains and contributes to this project](#who-maintains-and-contributes-to-this-project)
- [License](#license)

## What this project does:

This CRM Object Sync repository demonstrates best integration practices for syncing CRM contact records between HubSpot and external applications for a product management use case.

## Why is this project useful:

This project demonstrates how to:

- Set up HubSpot authentication and generate OAuth access and refresh tokens

- Create and seed a PostgreSQL database with contact records

- Sync seeded contact records from the database to HubSpot, saving the generated hs_object_id back to the database

- Sync contact records from HubSpot to the database:

  - The default sync option uses the Prisma upsert, matching by email. If there is a record match, it just adds the hs_object_id to the existing record. If the contact has no email, it creates a new record in the database. The job results will indicate how many records are upsert and the number of new records without email that were created.

  - The second option has more verbose reporting. It tries to create a new record in the database. If there's already a record with a matching email, it adds the hs_object_id to the existing record. Contacts without email are just created as normal. The results will indicate the number of records created (with or without email) and the number of existing records that the hs_object_id was added to.

## Setup

1. **Prerequisites**

   - Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
   - Create a new private app
   - Configure the following scopes:
     - `crm.objects.contacts.read`
     - `crm.objects.contacts.write`
     - `crm.objects.companies.read`
     - `crm.objects.companies.write`
     - `crm.schemas.contacts.read`
     - `crm.schemas.contacts.write`
     - `crm.schemas.companies.read`
     - `crm.schemas.companies.write`
   - Add `http://localhost:3001/oauth-callback` as a redirect URL
   - Save your Client ID and Client Secret for the next steps
   - Install [PostgreSQL](https://www.postgresql.org/download/)
   - Create an empty database
   - Have HubSpot app credentials ready

2. **Install Dependencies**

- Download and install PostgreSQL, make sure it's running, and create an empty database. You need the username and password (defaults username is postgres and no password)
- Clone the repo
- Create the .env file with these entries:
  - DATABASE_URL the (local) url to the postgres database (e.g. postgresql://{username}:{password}@localhost:5432/{database name})
  - CLIENT_ID from Hubspot private app
  - CLIENT_SECRET from Hubspot private app
- Run `npm install` to install the required Node packages.
- In your HubSpot private app, add `localhost:3001/api/install/oauth-callback` as a redirect URL
  Run npm run dev to start the server
  Visit http://localhost:3001/api/install in a browser to get the OAuth install link
  -Run `npm run seed` to seed the database with test data, select an industry for the data examples
  -Once the server is running, you can access the application and API documentation at http://localhost:3001/api-docs.

## Endpoints

### Authentication

- `GET /api/install` - Returns installation page with HubSpot OAuth link
- `GET /oauth-callback` - Processes OAuth authorization code
- `GET /` - Retrieves access token for authenticated user

### Contact Management

- `GET /contacts` - Fetches contacts from local database
- `GET /initial-contacts-sync` - Syncs contacts from HubSpot to local database
- `GET /sync-contacts` - Syncs contacts from local database to HubSpot
  - Uses email as primary key for deduplication
  - Excludes existing HubSpot contacts from sync batch

### Documentation

- `GET /api-docs` - Returns API documentation

## Scopes

- `crm.schemas.companies.write`
- `crm.schemas.contacts.write`
- `crm.schemas.companies.read`
- `crm.schemas.contacts.read`
- `crm.objects.companies.write`
- `crm.objects.contacts.write`
- `crm.objects.companies.read`
- `crm.objects.contacts.read`

## Available Scripts

- `npm run dev` - Start development server
- `npm run db-init` - Initialize database tables
- `npm run db-seed` - Seed database with test data
- `npm test` - Run tests
- `npm run test:coverage` - Generate test coverage report

## Dependencies

### Core

- Express
- Prisma
- PostgreSQL
- HubSpot Client Libraries

### Development

- Jest
- TypeScript
- ESLint
- Prettier

## Where to get help?

If you encounter any bugs or issues, please report them by opening a GitHub issue. For feedback or suggestions for new code examples, we encourage you to use this [form](https://survey.hsforms.com/1RT0f09LSTHuflzNtMbr2jA96it).

## Who maintains and contributes to this project

Various teams at HubSpot that focus on developer experience and app marketplace quality maintain and contribute to this project. In particular, this project was made possible by @therealdadams, @rahmona-henry, @zman81988, @natalijabujevic0708, and @zradford

## License

MIT
