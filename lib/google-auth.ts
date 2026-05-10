type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
};

type GoogleUserInfo = {
  sub: string; // Google ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to exchange code for tokens: ${errorText}`);
  }

  return tokenResponse.json();
}

export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userInfoResponse.ok) {
    const errorText = await userInfoResponse.text();
    throw new Error(`Failed to fetch user info: ${errorText}`);
  }

  return userInfoResponse.json();
}

export async function getGoogleUserFromCode(code: string): Promise<GoogleUserInfo> {
  const tokens = await exchangeCodeForTokens(code);
  return getUserInfo(tokens.access_token);
}

export function buildGooglePlaceholderPhone(googleId: string): string {
  return `google_${googleId}`;
}

export function isGooglePlaceholderPhone(phone: string): boolean {
  return phone.startsWith("google_");
}
