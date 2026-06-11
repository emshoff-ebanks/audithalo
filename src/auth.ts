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
        // Reject login attempts for soft-deleted accounts. The user is in
        // the 30-day grace window before purge; treat as if the account
        // doesn't exist.
        if (user.deletedAt) return null;

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
        token.name = user.name;
        token.email = user.email;
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
          // Soft-deleted: account is in the 30-day grace window. Sign them
          // out everywhere; the deleteAccountAction also bumped
          // sessionsValidFrom, but check deletedAt directly as belt-and-
          // suspenders.
          if (dbUser.deletedAt) return null;
          if (isTokenRevoked(token.iat, dbUser.sessionsValidFrom ?? null)) {
            return null;
          }
          // Refresh display-name + email on the JWT so account-page edits
          // (NameForm, EmailChangeForm) propagate without forcing a
          // re-login. Without this, the JWT stays stuck with the values
          // stamped at sign-in.
          if (dbUser.name !== undefined) token.name = dbUser.name;
          if (dbUser.email !== undefined) token.email = dbUser.email;
          if (dbUser.role && dbUser.role !== token.role) {
            token.role = dbUser.role;
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
        // Mirror name + email from token (refreshed in the jwt callback)
        // so every page that reads session.user.name picks up account
        // edits without needing a sign-out / sign-in cycle.
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
      }
      return session;
    },
  },
});
