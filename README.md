# CRM Object Sync

## What this project does:

This CRM Object Sync repository demonstrates best integration practices for syncing CRM  contact records between HubSpot and external applications for a product management use case.

## Why is this project useful:

This project demonstrates how to:

- Set up HubSpot authentication and generate OAuth access and refresh tokens

- Create and seed a PostgreSQL database with contact records

- Sync of seeded contact records from the database to HubSpot, saving the generated `hs_object_id`  back to the database

- Sync contact records from HubSpot to the database:

  - The default sync option uses the Prisma upsert, matching by email. If there is a record match, it just adds the `hs_object_id` to the existing record. If the contact has no email, it creates a new record in the database. The job results will indicate how many records are upsert and the number of new records without email that were created.

  - The second option has more verbose reporting. It tries to create a new record in the database. If there's already a record with a matching email, it adds the `hs_object_id` to the existing record. Contacts without email are just created as normal. The results will indicate the number of records created (with or without email) and the number of existing records that the `hs_object_id` was added to.

## Getting started with the project:

Setup:

1. Download and install [PostgreSQL](https://www.postgresql.org/download/), make sure it's running, and create an empty database. You need the username and password (defaults username is postgres and no password)

2. Clone the repo

3. Create the .env file with these entries (see examples in the [.env.example](./.env.example) file):

- DATABASE_URL the (local) url to the postgres database (e.g. `postgresql://{username}:{password}@localhost:5432/{database name}`

- CLIENT_ID from Hubspot public app

- CLIENT_SECRET from Hubspot public app

4. Run `npm install` to install the required Node packages.

5. Run `npm run db-init` to create the necessary tables in PostgreSQL

6. Optional: Run `npm dev seed` to seed the database with test data

7. In your [HubSpot public app](https://developers.hubspot.com/docs/api/creating-an-app), add localhost:3001/oauth-callback as a redirect URL

8. The app uses the following scopes:

- crm.schemas.companies.write

- crm.schemas.contacts.write

- crm.schemas.companies.read

- crm.schemas.contacts.read

9. Run `npm run dev` to start the server

10. Visit `http://localhost:3000/api/install` in a browser to get the OAuth install link

## Where to get help?

Please open an issue to report bugs or request features.

## Who maintains and contributes to this project

Various teams at HubSpot that focus on developer experience and app marketplace quality maintain and contribute to this project. In particular, this project was made possible by @therealdadams, @rahmona-henry and @zman81988
