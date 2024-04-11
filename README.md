# crm-object-sync

## What this project does:

This CRM Object Sync repository demonstrates best integration practices for syncing CRM contact records between HubSpot and external applications for a product management use case.

## Why is this project useful:

This project demonstrates how to:

- Set up HubSpot authentication and generate OAuth access and refresh tokens
- Create and seed a PostgreSQL database with contact records
- Sync of seeded contact records from the database to HubSpot, saving the generated hs_object_id back to the database
- Sync contact records from HubSpot to the database:
  - The default sync option uses the Prisma upsert, matching by email. If there is a record match, it just adds the hs_object_id to the existing record. If the contact has no email, it creates a new record in the database.
  - The second option has more verbose reporting. It tries to create a new record in the database. If there's already a record with a matching email, it adds the hs_object_id to the existing record. Contacts without email are just created as normal.

### Setup:

1. Download and install postgresql, make sure it's running, and create an empty database. You need the username and pass (defaults `postgres` and no password)
2. Clone the repo
3. Create the `.env` file with these entries:
   - `DATABASE_URL` the (local) url to the postgres database (e.g. `postgresql://{username}:{password}@localhost:5432/{database name}`
   - `CLIENT_ID` from hubspot public app
   - `CLIENT_SECRET` from hubspot public app
4. run `npm isntall`
5. run `npm run db-init`
6. run `npm run db-seed` optional to seed the database with some data
7. In your HubSpot public app, add `localhost:3000/oauth-callback` as a redirect URL
8. The app uses teh following scopes:
   - `crm.schemas.companies.write`
   - `crm.schemas.contacts.write`
   - `crm.schemas.companies.read`
   - `crm.schemas.contacts.read`
9. run `npm run dev` to start the server
10. Visit `http://localhost:3000/api/install` in a browser to get the oauth install link

## Where to get help?

Please open an issue to report bugs or request features.

## Who maintains and contributes to this project

Various teams at HubSpot that focus on developer experience and app marketplace quality maintain and contribute to this project.
