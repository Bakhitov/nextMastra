import { PostgresStore } from '@mastra/pg';

// Single, shared storage instance for the whole Mastra app
export const storage = new PostgresStore({
  connectionString: process.env.DATABASE_URL || '',
});


