import dotenv from "dotenv";
dotenv.config();

const requiredEnvVars = [
  "GEMINI_API_KEY"
];

// Optional but recommended for production
const productionEnvVars = [
  "MONGODB_URI",
  "JWT_SECRET"
];

const missingRequired = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingRequired.length > 0) {
  console.error(`\x1b[31mCritical Error: Missing required environment variables: ${missingRequired.join(", ")}\x1b[0m`);
  process.exit(1);
}

// In production, we enforce MongoDB and JWT_SECRET
if (process.env.NODE_ENV === "production") {
  const missingProd = productionEnvVars.filter(envVar => !process.env[envVar]);
  if (missingProd.length > 0) {
    console.error(`\x1b[31mCritical Error: Missing environment variables for production: ${missingProd.join(", ")}\x1b[0m`);
    process.exit(1);
  }
}

export const config = {
  port: process.env.PORT || 8080,
  geminiApiKey: process.env.GEMINI_API_KEY,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || "default_local_dev_secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "default_local_dev_refresh_secret",
  nodeEnv: process.env.NODE_ENV || "development",
  cloudinaryUrl: process.env.CLOUDINARY_URL
};
