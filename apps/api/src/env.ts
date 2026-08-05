export interface Env {
  DB: D1Database;
  BACKUPS: R2Bucket;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CORS_ORIGIN: string;
}

export type AuthVariables = {
  userId: string;
};
