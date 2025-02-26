import disconnectPrisma from '../../prisma/disconnect';
import { server } from '../app';

async function shutdown(): Promise<void> {
  try {
    console.log('Initiating graceful shutdown...');

    const closeServerPromise = new Promise<void>((resolve, reject) => {
      if (!server) {
        console.log('No server instance to close.');
        resolve();
        return;
      }

      server.close((err) => {
        console.log('Server close callback called.');
        if (err) {
          console.error('Error closing the server:', err);
          reject(err);
        } else {
          resolve();
        }
      });

      // Set a timeout in case the server does not close within a reasonable time
      setTimeout(() => {
        console.warn('Forcing server shutdown after timeout.');
        resolve();
      }, 5000);
    });

    await Promise.all([
      closeServerPromise
        .then(() => {
          console.log('HTTP server closed successfully.');
        })
        .catch((err) => {
          console.error('Error during server close:', err);
        }),
      disconnectPrisma().catch((err) =>
        console.error('Error during Prisma disconnection:', err)
      )
    ]);

    console.log('Graceful shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

export default shutdown;
