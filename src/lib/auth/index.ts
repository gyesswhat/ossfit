import NextAuth, { type DefaultSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, schema } from '@/lib/db';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

/**
 * [목적] Auth.js v5 GitHub OAuth 설정. DrizzleAdapter로 users/accounts를 upsert하되 세션은 JWT로 관리한다.
 * [주의] JWT 전략에서도 첫 로그인 시 adapter가 createUser + linkAccount를 실행해 users/accounts 테이블이 채워진다.
 *        accounts.access_token을 이후 Octokit 호출(UNIT-05)에서 읽으므로 adapter를 유지해야 한다.
 *        JWT payload는 공개 선언이 없는 모듈이라 커스텀 필드를 인덱스 접근으로 읽고 쓴다.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
  }),
  session: { strategy: 'jwt' },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: { params: { scope: 'read:user user:email public_repo' } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      const uid = token.uid;
      if (typeof uid === 'string') {
        session.user.id = uid;
      }
      const accessToken = token.accessToken;
      if (typeof accessToken === 'string') {
        session.accessToken = accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/ko/login',
  },
});
