const OAUTH_SERVICE_URL = process.env.OAUTH_SERVICE_URL || 'http://oauth-service:3001';

export async function getHubSpotToken(customerId: string): Promise<string> {
  try {
    const response = await fetch(`${OAUTH_SERVICE_URL}/api/get-token?customerId=${customerId}`);
    const data = await response.json();
    if (data.accessToken) {
      return data.accessToken;
    }
    throw new Error(data.errorMessage || 'Failed to get access token');
  } catch (error) {
    console.error('Failed to get token:', error);
    throw error;
  }
}
