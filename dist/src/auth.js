"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAccessToken = exports.getAccessToken = exports.redeemCode = exports.exchangeForTokens = exports.authUrl = void 0;
require("dotenv/config");
const client_1 = require("@prisma/client");
const utils_1 = require("./utils/utils");
const clients_1 = require("./clients");
const error_1 = __importDefault(require("./utils/error"));
class MissingRequiredError extends Error {
    constructor(message, options) {
        message = message + 'is missing, please add it to your .env file';
        super(message, options);
    }
}
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
if (!CLIENT_ID) {
    throw new MissingRequiredError('CLIENT_ID ', undefined);
}
if (!CLIENT_SECRET) {
    throw new MissingRequiredError('CLIENT_SECRET ', undefined);
}
const REDIRECT_URI = `http://localhost:${utils_1.PORT}/oauth-callback`;
const SCOPES = [
    'crm.schemas.companies.write',
    'crm.schemas.contacts.write',
    'crm.schemas.companies.read',
    'crm.schemas.contacts.read',
    'crm.objects.companies.write',
    'crm.objects.contacts.write',
    'crm.objects.companies.read',
    'crm.objects.contacts.read'
];
const EXCHANGE_CONSTANTS = {
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
};
const prisma = new client_1.PrismaClient();
const scopeString = SCOPES.toString().replaceAll(',', ' ');
const authUrl = clients_1.hubspotClient.oauth.getAuthorizationUrl(CLIENT_ID, REDIRECT_URI, scopeString);
exports.authUrl = authUrl;
const getExpiresAt = (expiresIn) => {
    const now = new Date();
    return new Date(now.getTime() + expiresIn * 1000);
};
const redeemCode = async (code) => {
    return await exchangeForTokens({
        ...EXCHANGE_CONSTANTS,
        code,
        grant_type: 'authorization_code'
    });
};
exports.redeemCode = redeemCode;
const getHubSpotId = async (accessToken) => {
    clients_1.hubspotClient.setAccessToken(accessToken);
    const hubspotAccountInfoResponse = await clients_1.hubspotClient.apiRequest({
        path: '/account-info/v3/details',
        method: 'GET'
    });
    const hubspotAccountInfo = await hubspotAccountInfoResponse.json();
    const hubSpotportalId = hubspotAccountInfo.portalId;
    return hubSpotportalId.toString();
};
const exchangeForTokens = async (exchangeProof) => {
    const { code, redirect_uri, client_id, client_secret, grant_type, refresh_token } = exchangeProof;
    const tokenResponse = await clients_1.hubspotClient.oauth.tokensApi.create(grant_type, code, redirect_uri, client_id, client_secret, refresh_token);
    try {
        const accessToken = tokenResponse.accessToken;
        const refreshToken = tokenResponse.refreshToken;
        const expiresIn = tokenResponse.expiresIn;
        const expiresAt = getExpiresAt(expiresIn);
        const customerId = (0, utils_1.getCustomerId)();
        const hsPortalId = await getHubSpotId(accessToken);
        const tokenInfo = await prisma.authorization.upsert({
            where: {
                customerId: customerId
            },
            update: {
                refreshToken,
                accessToken,
                expiresIn,
                expiresAt,
                hsPortalId
            },
            create: {
                refreshToken,
                accessToken,
                expiresIn,
                expiresAt,
                hsPortalId,
                customerId
            }
        });
        return tokenInfo;
    }
    catch (e) {
        console.error(`       > Error exchanging ${exchangeProof.grant_type} for access token`);
        console.error(e);
        throw e;
    }
};
exports.exchangeForTokens = exchangeForTokens;
const getAccessToken = async (customerId) => {
    try {
        const currentCreds = (await prisma.authorization.findFirst({
            select: {
                accessToken: true,
                expiresAt: true,
                refreshToken: true
            },
            where: {
                customerId
            }
        }));
        if (currentCreds?.expiresAt && currentCreds?.expiresAt > new Date()) {
            return currentCreds?.accessToken;
        }
        else {
            const updatedCreds = await exchangeForTokens({
                ...EXCHANGE_CONSTANTS,
                grant_type: 'refresh_token',
                refresh_token: currentCreds?.refreshToken
            });
            if (updatedCreds instanceof Error) {
                throw updatedCreds;
            }
            else {
                return updatedCreds?.accessToken;
            }
        }
    }
    catch (error) {
        console.error(error);
        throw error;
    }
};
exports.getAccessToken = getAccessToken;
async function setAccessToken() {
    try {
        const accessToken = await getAccessToken((0, utils_1.getCustomerId)());
        if (!accessToken) {
            throw new Error('No access token returned');
        }
        clients_1.hubspotClient.setAccessToken(accessToken);
        return clients_1.hubspotClient;
    }
    catch (error) {
        (0, error_1.default)(error, 'Error setting access token');
        throw new Error('Failed to authenticate HubSpot client');
    }
}
exports.setAccessToken = setAccessToken;
