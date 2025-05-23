import { getHubSpotToken } from './utils/oauth';
import { hubspotClient } from './clients';


export const getAccessToken = async (customerId: string): Promise<string> => {
  return getHubSpotToken(customerId);
};

export const getHubSpotId = async (accessToken: string) => {
  hubspotClient.setAccessToken(accessToken);
  const hubspotAccountInfoResponse = await hubspotClient.apiRequest({
    path: '/account-info/v3/details',
    method: 'GET'
  });

  const hubspotAccountInfo = await hubspotAccountInfoResponse.json();
  const hubSpotportalId = hubspotAccountInfo.portalId;
  return hubSpotportalId.toString();
};
