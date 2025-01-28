import express, { Application, Request, Response } from 'express';
import { authUrl, redeemCode, getAccessToken } from './auth';
import 'dotenv/config';
import { PORT, getCustomerId } from './utils';
import { initialContactsSync } from './initialSyncFromHubSpot';

import { syncContactsToHubSpot } from './initialSyncToHubSpot';
import { prisma } from './clients';

const app: Application = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/contacts', async (req: Request, res: Response) => {
  try {
    const contacts = await prisma.contacts.findMany({});
    res.send(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: "An error occurred while fetching contacts." });
  }
});

app.get('/api/install', (req: Request, res: Response) => {
  try {
    res.send(
      `<html><body><a href="${authUrl}" target="blank">${authUrl}</a></body></html>`
    );
  } catch (error) {
    console.error('Error rendering installation URL:', error);
    res.status(500).json({ message: "An error occurred while rendering the installation URL." });
  }
});

app.get('/sync-contacts', async (req: Request, res: Response) => {
  try {
    const syncResults = await syncContactsToHubSpot();
    res.send(syncResults);
  } catch (error) {
    console.error('Error syncing contacts:', error);
    res.status(500).json({ message: "An error occurred while syncing contacts." });
  }
});

app.get('/', async (req: Request, res: Response) => {
  try {
    const accessToken = await getAccessToken(getCustomerId());
    res.send(accessToken);
  } catch (error) {
    console.error('Error fetching access token:', error);
    res.status(500).json({ message: "An error occurred while fetching the access token." });
  }
});

app.get('/oauth-callback', async (req: Request, res: Response) => {
  const code = req.query.code;

  if (code) {
    try {
      const authInfo = await redeemCode(code.toString());
      const accessToken = authInfo.accessToken;
      res.redirect(`http://localhost:${PORT}/`);
    } catch (error: any) {
      console.error('Error redeeming code:', error);
      res.redirect(`/?errMessage=${error.message || "An error occurred during the OAuth process."}`);
    }
  } else {
    console.error('Error: code parameter is missing.');
    res.status(400).json({ message: "Code parameter is missing in the query string." });
  }
});

app.get('/initial-contacts-sync', async (req: Request, res: Response) => {
  try {
    const syncResults = await initialContactsSync();
    res.send(syncResults);
  } catch (error) {
    console.error('Error during initial contacts sync:', error);
    res.status(500).json({ message: "An error occurred during the initial contacts sync." });
  }
});

app.listen(PORT, function () {
  console.log(`App is listening on port ${PORT}`);
});
