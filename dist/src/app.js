"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
require("dotenv/config");
const utils_1 = require("./utils/utils");
const initialSyncFromHubSpot_1 = require("./initialSyncFromHubSpot");
const initialSyncToHubSpot_1 = require("./initialSyncToHubSpot");
const clients_1 = require("./clients");
const error_1 = __importDefault(require("./utils/error"));
const logger_1 = require("./utils/logger");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./swagger");
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/contacts', async (req, res) => {
    try {
        const contacts = await clients_1.prisma.contacts.findMany({});
        res.send(contacts);
    }
    catch (error) {
        (0, error_1.default)(error, 'Error fetching contacts');
        res
            .status(500)
            .json({ message: 'An error occurred while fetching contacts.' });
    }
});
app.get('/api/install', (req, res) => {
    res.send(`<html><body><a href="${auth_1.authUrl}" target="blank">${auth_1.authUrl}</a></body></html>`);
});
app.get('/sync-contacts', async (req, res) => {
    try {
        const syncResults = await (0, initialSyncToHubSpot_1.syncContactsToHubSpot)();
        res.send(syncResults);
    }
    catch (error) {
        (0, error_1.default)(error, 'Error syncing contacts');
        res
            .status(500)
            .json({ message: 'An error occurred while syncing contacts.' });
    }
});
app.get('/', async (req, res) => {
    try {
        const accessToken = await (0, auth_1.getAccessToken)((0, utils_1.getCustomerId)());
        res.send(accessToken);
    }
    catch (error) {
        (0, error_1.default)(error, 'Error fetching access token');
        res
            .status(500)
            .json({ message: 'An error occurred while fetching the access token.' });
    }
});
app.get('/oauth-callback', async (req, res) => {
    const code = req.query.code;
    if (code) {
        try {
            const authInfo = await (0, auth_1.redeemCode)(code.toString());
            const accessToken = authInfo.accessToken;
            logger_1.logger.info({
                type: 'HubSpot',
                logMessage: {
                    message: 'OAuth complete!'
                }
            });
            res.redirect(`http://localhost:${utils_1.PORT}/`);
        }
        catch (error) {
            (0, error_1.default)(error, 'Error redeeming code during OAuth');
            res.redirect(`/?errMessage=${error.message || 'An error occurred during the OAuth process.'}`);
        }
    }
    else {
        logger_1.logger.error({
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
app.get('/initial-contacts-sync', async (req, res) => {
    try {
        const syncResults = await (0, initialSyncFromHubSpot_1.initialContactsSync)();
        res.send(syncResults);
    }
    catch (error) {
        (0, error_1.default)(error, 'Error during initial contacts sync');
        res
            .status(500)
            .json({ message: 'An error occurred during the initial contacts sync.' });
    }
});
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.specs));
let server = null;
exports.server = server;
function startServer() {
    if (!server) {
        exports.server = server = app.listen(utils_1.PORT, function (err) {
            if (err) {
                console.error('Error starting server:', err);
                return;
            }
            console.log(`App is listening on port ${utils_1.PORT}`);
        });
    }
    return server;
}
exports.startServer = startServer;
// Start the server only if this file is run directly
if (require.main === module) {
    startServer();
}
