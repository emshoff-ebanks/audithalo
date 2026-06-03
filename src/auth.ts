import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isTokenRevoked } from "@/lib/auth-tokens";
import { findBackupCodeMatch, verifyTotpCode } from "@/lib/totp";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  // Optional second-factor: when the user has 2FA enabled, this must be a
  // valid 6-digit TOTP code OR one of their single-use backup codes.
  // Users without 2FA can leave this blank — it's ignored in that case.
  totpCode: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "TOTP code", type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password, totpCode } = parsed.data;
        const user = await db.query.users.findFirst({
          where: eq(schema.users.email, email.toLowerCase()),
        });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // If 2FA is enabled, require a valid TOTP code OR backup code. We
        // intentionally return null (generic "invalid credentials") rather
        // than a 2FA-specific error to avoid leaking whether 2FA is set up
        // on this account to a brute-forcer.
        if (user.totpEnabledAt && user.totpSecret) {
          if (!totpCode) return null;

          const totpOk = verifyTotpCode(totpCode, user.totpSecret);
          if (!totpOk) {
            // TOTP didn't match — try backup codes.
            const codes = user.totpBackupCodes ?? [];
            if (codes.length === 0) return null;
            const backupIdx = findBackupCodeMatch(totpCode, codes);
            if (backupIdx === -1) return null;
            // Consume the matched backup code — single-use semantics.
            const remaining = [...codes];
            remaining.splice(backupIdx, 1);
            await db
              .update(schema.users)
              .set({ totpBackupCodes: remaining })
              .where(eq(schema.users.id, user.id));
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: populate the token from the authenticated user.
      // No need to re-check revocation — we just issued this token.
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "supervisee";
        return token;
      }

      // Subsequent requests: re-validate the token against the user's
      // sessionsValidFrom cutoff. Returning null invalidates the session.
      if (token.id && typeof token.iat === "number") {
        try {
          const dbUser = await db.query.users.findFirst({
            where: eq(schema.users.id, token.id as string),
          });
          // User was deleted — invalidate any lingering tokens.
          if (!dbUser) return null;
          if (isTokenRevoked(token.iat, dbUser.sessionsValidFrom ?? null)) {
            return null;
          }
        } catch (err) {
          // DB hiccup: prefer keeping the user signed in rather than
          // logging them out on every transient DB error. Auth.js will
          // re-check on the next request.
          console.error("[auth] jwt revocation check failed:", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "supervisee";
      }
      return session;
    },
  },
});
