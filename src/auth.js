"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = exports.redeemCode = exports.exchangeForTokens = exports.authUrl = void 0;
require("dotenv/config");
const hubspot = __importStar(require("@hubspot/api-client"));
const client_1 = require("@prisma/client");
const utils_1 = require("./utils");
const CLIENT_ID = process.env.CLIENT_ID || "CLIENT_ID required";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "CLIENT_SECRET required";
const REDIRECT_URI = `http://localhost:${utils_1.PORT}/oauth-callback`;
const SCOPES = [
    "crm.schemas.companies.write",
    "crm.schemas.contacts.write",
    "crm.schemas.companies.read",
    "crm.schemas.contacts.read",
];
const EXCHANGE_CONSTANTS = {
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
};
const hubspotClient = new hubspot.Client();
const prisma = new client_1.PrismaClient();
const scopeString = SCOPES.toString().replaceAll(",", " ");
const authUrl = hubspotClient.oauth.getAuthorizationUrl(CLIENT_ID, REDIRECT_URI, scopeString);
exports.authUrl = authUrl;
const getExpiresAt = (expiresIn) => {
    const now = new Date();
    return new Date(now.getTime() + expiresIn * 1000);
};
const redeemCode = (code) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exchangeForTokens(Object.assign(Object.assign({}, EXCHANGE_CONSTANTS), { code, grant_type: "authorization_code" }));
});
exports.redeemCode = redeemCode;
const getHubSpotId = (accessToken) => __awaiter(void 0, void 0, void 0, function* () {
    hubspotClient.setAccessToken(accessToken);
    const hubspotAccountInfoResponse = yield hubspotClient.apiRequest({
        path: "/account-info/v3/details",
        method: "GET",
    });
    const hubspotAccountInfo = yield hubspotAccountInfoResponse.json();
    const hubSpotportalId = hubspotAccountInfo.portalId;
    return hubSpotportalId.toString();
});
const exchangeForTokens = (exchangeProof) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, redirect_uri, client_id, client_secret, grant_type, refresh_token, } = exchangeProof;
    const tokenResponse = yield hubspotClient.oauth.tokensApi.createToken(grant_type, code, redirect_uri, client_id, client_secret, refresh_token);
    try {
        const accessToken = tokenResponse.accessToken;
        const refreshToken = tokenResponse.refreshToken;
        const expiresIn = tokenResponse.expiresIn;
        const expiresAt = getExpiresAt(expiresIn);
        const customerId = (0, utils_1.getCustomerId)();
        const hsPortalId = yield getHubSpotId(accessToken);
        const tokenInfo = yield prisma.authorization.upsert({
            where: {
                customerId: customerId,
            },
            update: {
                refreshToken,
                accessToken,
                expiresIn,
                expiresAt,
                hsPortalId,
            },
            create: {
                refreshToken,
                accessToken,
                expiresIn,
                expiresAt,
                hsPortalId,
                customerId,
            },
        });
        return tokenInfo;
    }
    catch (e) {
        console.error(`       > Error exchanging ${exchangeProof.grant_type} for access token`);
        console.error(e);
        throw e;
    }
});
exports.exchangeForTokens = exchangeForTokens;
const getAccessToken = (customerId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentCreds = (yield prisma.authorization.findFirst({
            select: {
                accessToken: true,
                expiresAt: true,
                refreshToken: true,
            },
            where: {
                customerId,
            },
        }));
        if ((currentCreds === null || currentCreds === void 0 ? void 0 : currentCreds.expiresAt) && (currentCreds === null || currentCreds === void 0 ? void 0 : currentCreds.expiresAt) > new Date()) {
            return currentCreds === null || currentCreds === void 0 ? void 0 : currentCreds.accessToken;
        }
        else {
            const updatedCreds = yield exchangeForTokens(Object.assign(Object.assign({}, EXCHANGE_CONSTANTS), { grant_type: "refresh_token", refresh_token: currentCreds === null || currentCreds === void 0 ? void 0 : currentCreds.refreshToken }));
            if (updatedCreds instanceof Error) {
                throw updatedCreds;
            }
            else {
                return updatedCreds === null || updatedCreds === void 0 ? void 0 : updatedCreds.accessToken;
            }
        }
    }
    catch (error) {
        console.error(error);
        throw error;
    }
});
exports.getAccessToken = getAccessToken;
