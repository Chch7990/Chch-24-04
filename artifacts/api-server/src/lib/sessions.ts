// Shared in-memory session store. Resets on server restart.
export const adminSessions = new Map<string, { email: string; createdAt: number }>();
