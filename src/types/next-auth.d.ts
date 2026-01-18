import 'next-auth';

declare module 'next-auth' {
  /**
   * Extends the built-in session.user type to include steamId.
   */
  interface Session {
    user?: {
      steamId?: string | null;
    } & DefaultSession['user'];
  }

  /**
   * Extends the built-in user type.
   */
  interface User {
    steamId?: string | null;
  }
}
