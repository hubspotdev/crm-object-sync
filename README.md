# CRM-Object-Sync
CRM Object Sync examples for Project Management use cases 

### Setup:
1. Download and install postgresql, make sure it's running, and create an empty database. You need the username and pass (defaults `postgres` and no password)
2. Clone the repo
3. Create the `.env` file with these entries:
    * `DATABASE_URL` the (local) url to the postgres database (e.g. `postgresql://{username}:{password}@localhost:5432/{database name}`
    * `CLIENT_ID` from hubspot public app
    * `CLIENT_SECRET` from hubspot public app
4. run `npm isntall`
5. run `npm run db-init`
6. run `npm dev seed` optional to seed the database with some data
7. In your HubSpot public app, add `localhost:3001/oauth-callback` as a redirect URL
8. The app uses teh following scopes:
    * `crm.schemas.companies.write`
    * `crm.schemas.contacts.write`
    * `crm.schemas.companies.read`
    * `crm.schemas.contacts.read`
10. run `npm run dev` to start the server
11. Visit `http://localhost:3001/api/install` in a browser to get the oauth install link
