import admin from 'firebase-admin';

const serviceAccount = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : "UNAVAILABLE",
  client_email: "firebase-adminsdk-p193j@dedra-mlm.iam.gserviceaccount.com"
};

// I will just use the check_data.js file that's already there
