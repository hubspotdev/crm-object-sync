import disconnectPrisma from '../../prisma/disconnect';
import { server } from '../app';
import { logger } from './logger';

async function shutdown(): Promise<void> {
  try {
    logger.info({
      type: 'Server',
      context: 'Shutdown',
      logMessage: {
        message: 'Initiating graceful shutdown'
      }
    });

    const closeServerPromise = new Promise<void>((resolve, reject) => {
      if (!server) {
        logger.info({
          type: 'Server',
          context: 'Shutdown',
          logMessage: {
            message: 'No server instance to close'
          }
        });
        resolve();
        return;
      }

      server.close((err) => {
        logger.info({
          type: 'Server',
          context: 'Shutdown',
          logMessage: {
            message: 'Server close callback called'
          }
        });

        if (err) {
          logger.error({
            type: 'Server',
            context: 'Shutdown',
            logMessage: {
              message: 'Error closing the server',
              stack: err instanceof Error ? err.stack : undefined
            }
          });
          reject(err);
        } else {
          resolve();
        }
      });

      // Set a timeout in case the server does not close within a reasonable time
      setTimeout(() => {
        logger.warn({
          type: 'Server',
          context: 'Shutdown',
          logMessage: {
            message: 'Forcing server shutdown after timeout'
          }
        });
        resolve();
      }, 5000);
    });

    await Promise.all([
      closeServerPromise
        .then(() => {
          logger.info({
            type: 'Server',
            context: 'Shutdown',
            logMessage: {
              message: 'HTTP server closed successfully'
            }
          });
        })
        .catch((err) => {
          logger.error({
            type: 'Server',
            context: 'Shutdown',
            logMessage: {
              message: 'Error during server close',
              stack: err instanceof Error ? err.stack : undefined
            }
          });
        }),
      disconnectPrisma().catch((err) => {
        logger.error({
          type: 'Database',
          context: 'Shutdown',
          logMessage: {
            message: 'Error during Prisma disconnection',
            stack: err instanceof Error ? err.stack : undefined
          }
        });
      })
    ]);

    logger.info({
      type: 'Server',
      context: 'Shutdown',
      logMessage: {
        message: 'Graceful shutdown complete'
      }
    });
    process.exit(0);
  } catch (err) {
    logger.error({
      type: 'Server',
      context: 'Shutdown',
      logMessage: {
        message: 'Error during shutdown',
        stack: err instanceof Error ? err.stack : undefined
      }
    });
    process.exit(1);
  }
}

export default shutdown;
