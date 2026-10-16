import { google } from "googleapis";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

// Get Gmail credentials from environment variables
function getGmailCredentials() {
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
    return {
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
    };
  }

  throw new Error("Gmail credentials not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env");
}

// Create OAuth2 client for Gmail
export function createOAuth2Client(redirectToFrontend = false) {
  const credentials = getGmailCredentials();
  const redirectUri = redirectToFrontend
    ? "https://pipeline-crm-demo.web.app/settings"
    : "https://us-central1-pipeline-crm-demo.cloudfunctions.net/gmailCallback";

  console.log("[Gmail Config] Creating OAuth2 client with:", {
    clientId: credentials.clientId.substring(0, 20) + "...",
    redirectUri,
  });

  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    redirectUri
  );
}

// Get authenticated Gmail client
export async function getGmailClient() {
  const configDoc = await db.collection("config").doc("gmail").get();

  if (!configDoc.exists) {
    throw new Error("Gmail not connected. Please connect Gmail in Settings.");
  }

  const config = configDoc.data();
  if (!config?.refreshToken) {
    throw new Error("Gmail refresh token not found. Please reconnect Gmail.");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: config.refreshToken,
  });

  // Refresh access token if needed
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  return google.gmail({ version: "v1", auth: oauth2Client });
}

// Get authenticated People API client (for Google Contacts)
export async function getPeopleClient() {
  const configDoc = await db.collection("config").doc("gmail").get();

  if (!configDoc.exists) {
    throw new Error("Gmail not connected. Please connect Gmail in Settings.");
  }

  const config = configDoc.data();
  if (!config?.refreshToken) {
    throw new Error("Gmail refresh token not found. Please reconnect Gmail.");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: config.refreshToken,
  });

  // Refresh access token if needed
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  return google.people({ version: "v1", auth: oauth2Client });
}

// Collection references
export const collections = {
  sequences: "sequences",
  leads: "leads",
  leadSequences: "leadSequences",
  emailEvents: "emailEvents",
  config: "config",
  // Newsletter collections
  newsletterLists: "newsletterLists",
  newsletters: "newsletters",
  newsletterRecipients: "newsletterRecipients",
  newsletterSendRequests: "newsletterSendRequests",
  contacts: "contacts",
};
