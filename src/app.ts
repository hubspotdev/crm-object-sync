import express, { Application, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authUrl, redeemCode, getAccessToken } from './auth';
import 'dotenv/config';
import { PORT, getCustomerId } from './utils';
import { syncContactsToHubSpot } from './initialContactSync';

const prisma = new PrismaClient();
const app: Application = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/contacts', async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  const contacts = await prisma.contacts.findMany({});
  res.send(contacts);
});

app.get('/api/install', (req: Request, res: Response) => {
  res.send(authUrl);
});

app.get('/sync-contacts-test', async (req: Request, res: Response) => {
  const syncResults = await syncContactsToHubSpot();
  res.send(syncResults);
});
app.get('/', async (req: Request, res: Response) => {
  const accessToken = await getAccessToken(getCustomerId());

  res.send(accessToken);
});

app.get('/oauth-callback', async (req: Request, res: Response) => {
  const code = req.query.code;

  if (code) {
    try {
      const authInfo = await redeemCode(code.toString());
      const accessToken = authInfo.accessToken;
      syncContactsToHubSpot();
      res.redirect(`http://localhost:${PORT}/`);
    } catch (error: any) {
      res.redirect(`/?errMessage=${error.message}`);
    }
  }
});

app.listen(PORT, function () {
  console.log(`App is listening on port ${PORT}`);
});
