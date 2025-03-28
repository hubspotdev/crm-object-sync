# CRM Object Sync

CRM Object Sync repository demonstrates best practices for syncing CRM contact records between HubSpot and external applications. Built with Docker, Node.js, and PostgreSQL for seamless deployment and development.

## Table of Contents
- [What this project does](#what-this-project-does)
- [Why is this project useful](#why-is-this-project-useful)
- [Getting started with the project](#getting-started-with-the-project)
  - [Setup](#setup)
  - [Scopes](#scopes)
- [Endpoints](#endpoints)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Synchronization Endpoints](#synchronization-endpoints)
- [Available Scripts](#available-scripts)
- [Dependencies](#dependencies)
  - [Core](#core)
  - [Development](#development)
- [Where to get help?](#where-to-get-help)
- [Who maintains and contributes to this project](#who-maintains-and-contributes-to-this-project)
- [License](#license)


## What this project does:

This CRM Object Sync repository offers guidelines and practical examples to help maintain data consistency and simplify management across multiple platforms, now containerized with Docker for easier setup and deployment.

## Why is this project useful:

This project demonstrates how to:

- Set up HubSpot authentication and generate OAuth access and refresh tokens
- Create and manage a containerized PostgreSQL database with contact records
- Sync data between HubSpot and PostgreSQL within a Docker environment:

  - Sync of seeded contact records from the database to HubSpot, saving the generated `hs_object_id`  back to the database

  - Sync contact records from HubSpot to the database:

    - The default sync option uses the Prisma upsert, matching by email. If there is a record match, it just adds the `hs_object_id` to the existing record. If the contact has no email, it creates a new record in the database. The job results will indicate how many records are upsert and the number of new records without email that were created.

    - The second option has more verbose reporting. It tries to create a new record in the database. If there's already a record with a matching email, it adds the `hs_object_id` to the existing record. Contacts without email are just created as normal. The results will indicate the number of records created (with or without email) and the number of existing records that the `hs_object_id` was added to.

 ## Getting started with the project:

### Setup:

1. Clone the repo

2. Create the .env file with these entries (see examples in the [.env.example](./.env.example) file):
     - CLIENT_ID from Hubspot public app
     - CLIENT_SECRET from Hubspot public app
     - SEED_DATABASE (Optional: set to true to seed the database)

3. In your [HubSpot public app](https://developers.hubspot.com/docs/api/creating-an-app), add `localhost:3000/oauth-callback` as a redirect URL, set the required scopes to be those in the [Scopes](#scopes) section down below

4. Build and run the application:
- First time setup (with database initialization)
`docker-compose up setup --build`

- Start the application
`docker-compose up app`

5. Visit `http://localhost:3000/api/install` in a browser to get the OAuth install link

### Scopes

- `crm.objects.contacts.read` - View properties and other details about contacts
- `crm.objects.contacts.write` - View properties and create, delete, and make changes to contacts
- `crm.objects.companies.read` - View properties and other details about companies
- `crm.objects.companies.write` - View properties and create, delete, or make changes to companies
- `crm.schemas.contacts.read` - View details about property settings for contacts.
- `crm.schemas.contacts.write` - Create, delete, or make changes to property settings for contacts
- `crm.schemas.companies.read` - View details about property settings for companies
- `crm.schemas.companies.write` - Create, delete, or make changes to property settings for companies
- `oauth` - Basic scope required for OAuth. This scope is added by default to all apps

## Endpoints:
### Authentication Endpoints

- `GET /api/install`: Sends a simple HTML response containing a link (authUrl) for users to authenticate. The link opens in a new tab when clicked. This should be the first step a new user or client performs to initiate the OAuth2 authorization process.

- `GET /oauth-callback`: It processes the authorization code to obtain an access token for the user and any failure in retrieving it redirects with an error message.

- `GET /` : Once authenticated, the access token can be retrieved using this endpoint. This ensures that any subsequent API operations requiring authentication can be performed.

### Synchronization Endpoints

- `GET /initial-contacts-sync`: After establishing authentication and obtaining an access token, the initial **synchronization of contacts from HubSpot to the local database** can occur.

- `GET /contacts`: This endpoint fetches contacts from the local database.

- `GET /sync-contacts`: This is used to **synchronize any updates or new contact data from the local database to HubSpot**. Email is used as a primary key for logical deduplication, making it crucial that email addresses are correctly managed and non-null where possible. To minimize errors, we first retrieve existing contacts from HubSpot and exclude those already known from our batch. The following methods are employed to send new contacts to HubSpot and to store their HubSpot object IDs back in our local database.

## Available Scripts

- `docker-compose up setup --build` - First time setup (with database initialization)
- `docker-compose up app` - Start the application
- `docker-compose exec app npm run db-seed` - Seed the database
- `docker-compose exec app npm test` - Run test suite
- `docker-compose exec app npm run test:watch` - Run tests in watch mode
- `docker-compose exec app npm run test:coverage` - Generate test coverage report

## Dependencies

All dependencies are automatically handled by Docker. However, for reference, here are the key packages used:

### Core Dependencies
These are included in the Docker container:
- `@hubspot/api-client` - HubSpot API integration
- `@hubspot/cli-lib` - HubSpot CLI tools
- `@prisma/client` - Database ORM
- `express` - Web framework
- `dotenv` - Environment configuration
- `@ngrok/ngrok` - Secure tunneling
- `axios` - HTTP client
- `prompts` - CLI prompts

### Development Dependencies
These are also included in the Docker environment:
- `typescript` - Programming language
- `jest` - Testing framework
- `prisma` - Database toolkit
- `nodemon` - Development server
- `supertest` - API testing
- `eslint` - Code linting
- `ts-node` - TypeScript execution
- `prettier` - Code formatting
- `ts-jest` - TypeScript testing support


## Where to get help?

If you encounter any bugs or issues, please report them by opening a GitHub issue. For feedback or suggestions for new code examples, we encourage you to use this [form](https://survey.hsforms.com/1RT0f09LSTHuflzNtMbr2jA96it).

## Who maintains and contributes to this project

Various teams at HubSpot that focus on developer experience and app marketplace quality maintain and contribute to this project. In particular, this project was made possible by @therealdadams, @rahmona-henry, @zman81988, @natalijabujevic0708, and @zradford

## License

MIT
