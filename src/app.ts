import express, { Application, Request, Response } from 'express';
import { getAccessToken } from './auth';
import 'dotenv/config';
import { PORT, getBooleanFromString, getCustomerId } from './utils/utils';
import { initialContactsSync } from './initialSyncFromHubSpot';
import { syncContactsToHubSpot } from './initialSyncToHubSpot';
import { prisma } from './clients';
import handleError from './utils/error';
import { logger } from './utils/logger';
import { Server } from 'http';

const app: Application = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/contacts', async (req: Request, res: Response) => {
  try {
    const contacts = await prisma.contacts.findMany({});
    res.send(contacts);
  } catch (error) {
    handleError(error, 'Error fetching contacts');
    res
      .status(500)
      .json({ message: 'An error occurred while fetching contacts.' });
  }
});

app.get('/sync-contacts', async (req: Request, res: Response) => {
  try {
    const syncResults = await syncContactsToHubSpot();
    res.send(syncResults);
  } catch (error) {
    handleError(error, 'Error syncing contacts');
    res
      .status(500)
      .json({ message: 'An error occurred while syncing contacts.' });
  }
});

app.get('/', async (req: Request, res: Response) => {
  try {
    const accessToken = await getAccessToken(getCustomerId());
    res.send(accessToken);
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'statusCode' in error && error.statusCode === 401) {
      res.redirect("/api/install");
    }
    handleError(error, 'Error fetching access token');
    res
      .status(500)
      .json({ message: 'An error occurred while fetching the access token.' });
  }
});

app.get('/oauth-callback', async (req: Request, res: Response) => {
  const code = req.query.code;
  if (code) {
    try {
      const authInfo = await redeemCode(code.toString());
      const accessToken = authInfo.accessToken;
      logger.info({
        type: 'HubSpot',
        logMessage: {
          message: 'OAuth complete!'
        }
      });
      res.redirect(`http://localhost:${PORT}/`);
    } catch (error: any) {
      handleError(error, 'Error redeeming code during OAuth');
      res.redirect(
        `/?errMessage=${error.message || 'An error occurred during the OAuth process.'}`
      );
    }
  } else {
    logger.error({
      type: 'HubSpot',
      logMessage: {
        message: 'Error: code parameter is missing.'
      }
    });
    res
      .status(400)
      .json({ message: 'Code parameter is missing in the query string.' });
  }
});

app.get('/initial-contacts-sync', async (req: Request, res: Response) => {
  const useVerboseCreateOrUpdate = (req.query.verbose === 'true');

  logger.info({
    type: 'HubSpot',
    logMessage: {
      message: `Initial contacts sync started using ${useVerboseCreateOrUpdate ? "verbose" : "normal" } mode`
    }
  });
  const typeSafeVerboseArgument = getBooleanFromString(useVerboseCreateOrUpdate.toString());
  try {
    const syncResults = await initialContactsSync(typeSafeVerboseArgument);
    res.send(syncResults);
  } catch (error) {
    if (error instanceof Error) {
      // Check if error is an API error with a code property
      // TODO move to middleware function so it doesn't have to be repeated for each endpoint
      if ((error as any).code == 401) {
        logger.info({
          type: 'HubSpot',
          logMessage: {
            message: 'Unauthorized error during initial contacts sync. Redirecting to install page.'
          }
        });
        res.redirect("http://localhost:3001/install");

        return;
      }
      handleError(error, 'Error during initial contacts sync');
      res
      .status(500)
      .json({ message: 'An error occurred during the initial contacts sync.' });
  }
}});

let server: Server | null = null;

function startServer() {
  if (!server) {
    server = app.listen(PORT, function (err?: Error) {
      if (err) {
        console.error('Error starting server:', err);
        return;
      }
      console.log(`App is listening on port ${PORT}`);
    });
  }
  return server;
}

// Start the server only if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, server, startServer };
