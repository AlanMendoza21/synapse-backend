const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const required = ['JWT_SECRET', 'ENCRYPTION_KEY', 'DB_HOST', 'DB_NAME'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:80',

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'synapse_app',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'synapse',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    inputPricePerM: parseFloat(process.env.GEMINI_INPUT_PRICE_PER_M) || 0.10,
    outputPricePerM: parseFloat(process.env.GEMINI_OUTPUT_PRICE_PER_M) || 0.40,
  },

  limits: {
    freeDailyMessages: parseInt(process.env.FREE_DAILY_MESSAGES) || 15,
    freeDailyTasks: parseInt(process.env.FREE_DAILY_TASKS) || 5,
    freeDailyPlans: parseInt(process.env.FREE_DAILY_PLANS) || 1,
    freeDailyReorganizations: parseInt(process.env.FREE_DAILY_REORGANIZATIONS) || 1,
  },
};
