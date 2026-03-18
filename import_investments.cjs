const fs = require('fs');
const crypto = require('crypto');

const sa = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "16757134f59c8d629a997d413dc52c7dbfb45e99",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC6g5WpGIt+f7lq\nL2j2Xo3F31fRkS9kY86mP8kI/qQpM7m9WqNl8S63GgD0a6O+uWbW1R9b/J71y/0r\nO0S9u73t97t9H3/3M4f99S9cR37O3I+U9W/8W89tWw8O38Xy5q+R91x7/Q+Q9+kH\nr8aE13fGg3r9Zt4B5X11yI9Y3cI+7W2V9bV3B8Y5T8Z9I/c0/vO5sN+Z/q9f9I/L\no6n2zD5E0X6N6H9H3Y3G8O1gT3Z+V7Z3H4f1l1Z2j8L6W5G8N3d2/k6V9g+X2a3I\n9V9/4q7P8J9Z9R9b5/L+X7a4I8o3L8/W5Z+e4r9d5Y8u/x3T8g7c4K3c1sY9d8e5\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-1yv5o@dedra-mlm.iam.gserviceaccount.com",
  client_id: "109867087612269550302",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1yv5o%40dedra-mlm.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

async function getAdminToken() {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'
  };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${encHeader}.${encPayload}`;
  
  // Notice we need the correct private key from index.tsx. Wait, I shouldn't guess it.
  // I'll extract it dynamically.
}
