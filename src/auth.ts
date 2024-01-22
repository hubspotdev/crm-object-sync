import "dotenv/config";
import * as hubspot from "@hubspot/api-client";
import { Authorization, PrismaClient} from "@prisma/client";
import { PORT, getCustomerId } from "./utils";

interface ExchangeProof {
  grant_type: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  code?: string;
  refresh_token?: string;
}

const CLIENT_ID: string = process.env.CLIENT_ID || "CLIENT_ID required";
const CLIENT_SECRET: string =
  process.env.CLIENT_SECRET || "CLIENT_SECRET required";

const REDIRECT_URI: string = `http://localhost:${PORT}/oauth-callback`;

const SCOPES = [
  "crm.schemas.companies.write",
  "crm.schemas.contacts.write",
  "crm.schemas.companies.read",
  "crm.schemas.contacts.read",
  "rahmona.henry"
];

const EXCHANGE_CONSTANTS = {
  redirect_uri: REDIRECT_URI,
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
};

const hubspotClient = new hubspot.Client();

const prisma = new PrismaClient();

const scopeString = SCOPES.toString().replaceAll(",", " ");

const authUrl = hubspotClient.oauth.getAuthorizationUrl(
  CLIENT_ID,
  REDIRECT_URI,
  scopeString
);

const getExpiresAt = (expiresIn: number): Date => {
  const now = new Date();

  return new Date(now.getTime() + expiresIn * 1000);
};

const redeemCode = async (code: string): Promise<Authorization> => {
  return await exchangeForTokens({
    ...EXCHANGE_CONSTANTS,
    code,
    grant_type: "authorization_code",
  });
};

const getHubSpotId = async (accessToken: string) => {
  hubspotClient.setAccessToken(accessToken);
  const hubspotAccountInfoResponse = await hubspotClient.apiRequest({
    path: "/account-info/v3/details",
    method: "GET",
  });

  const hubspotAccountInfo = await hubspotAccountInfoResponse.json();
  const hubSpotportalId = hubspotAccountInfo.portalId;
  return hubSpotportalId.toString();
};

const exchangeForTokens = async (
  exchangeProof: ExchangeProof
): Promise<Authorization> => {
  const {
    code,
    redirect_uri,
    client_id,
    client_secret,
    grant_type,
    refresh_token,
  } = exchangeProof;
  const tokenResponse = await hubspotClient.oauth.tokensApi.createToken(
    grant_type,
    code,
    redirect_uri,
    client_id,
    client_secret,
    refresh_token
  );

  try {
    const accessToken: string = tokenResponse.accessToken;
    const refreshToken: string = tokenResponse.refreshToken;
    const expiresIn: number = tokenResponse.expiresIn;
    const expiresAt: Date = getExpiresAt(expiresIn);
    const customerId = getCustomerId();
    const hsPortalId = await getHubSpotId(accessToken);
    const tokenInfo = await prisma.authorization.upsert({
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
  } catch (e) {
    console.error(
      `       > Error exchanging ${exchangeProof.grant_type} for access token`
    );
    console.error(e);
    throw e;
  }
};

const getAccessToken = async (customerId: string): Promise<string> => {
  try {
    const currentCreds = (await prisma.authorization.findFirst({
      select: {
        accessToken: true,
        expiresAt: true,
        refreshToken: true,
      },
      where: {
        customerId,
      },
    })) as Authorization;
    if (currentCreds?.expiresAt && currentCreds?.expiresAt > new Date()) {
      return currentCreds?.accessToken;
    } else {
      const updatedCreds = await exchangeForTokens({
        ...EXCHANGE_CONSTANTS,
        grant_type: "refresh_token",

        refresh_token: currentCreds?.refreshToken,
      });
      if (updatedCreds instanceof Error) {
        throw updatedCreds;
      } else {
        return updatedCreds?.accessToken;
      }
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export { authUrl, exchangeForTokens, redeemCode, getAccessToken };