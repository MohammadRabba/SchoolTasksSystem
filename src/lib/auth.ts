import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// ============================================================
// Vercel-aware URL resolution
// ============================================================
// NextAuth v4 needs NEXTAUTH_URL to match the public URL exactly.
// On Vercel, this is automatically set via the `x-forwarded-host`
// and `x-forwarded-proto` headers. We compute it dynamically so the
// same build works on `localhost`, Vercel preview, and production URLs.

function getAuthUrl(): string {
  // Explicit override takes priority
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  // Vercel detection (works for preview + production deployments)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Local development fallback
  return "http://localhost:3000";
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 hours
  // `trustHost: true` is required by NextAuth v4 in production (Vercel, etc.)
  ...(process.env.NODE_ENV === "production" ? { trustHost: true } : {}),
  cookies: {
    sessionToken: {
      // Must use the `__Secure-` prefix in production. Middleware `getToken()`
      // looks for that name on HTTPS/Vercel; a plain `next-auth.session-token`
      // cookie makes login succeed but every protected API return 401.
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Admin Credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("البريد الإلكتروني وكلمة المرور مطلوبان");
        }

        const admin = await db.admin.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!admin) {
          throw new Error("البيانات غير صحيحة");
        }
        const ok = await bcrypt.compare(credentials.password, admin.passwordHash);
        if (!ok) {
          throw new Error("البيانات غير صحيحة");
        }
        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours from login
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session as any).expiresAt = (token.expiresAt as number) || (Date.now() + 8 * 60 * 60 * 1000);
      }
      return session;
    },
  },
  events: {
    async signOut() {
      // We can't easily access the admin ID here without extra plumbing.
      // The audit log on logout is best handled client-side if needed.
    },
  },
  pages: {
    signIn: "/",
  },
};

// Expose the computed URL for debugging / logging if needed
export const authUrl = getAuthUrl();

// Server-side helper to enforce auth in API routes
export async function requireAdmin(): Promise<{ id: string; email: string; name: string }> {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("UNAUTHORIZED");
  }
  return {
    id: (session.user as { id?: string }).id || "",
    email: session.user.email,
    name: session.user.name || "",
  };
}
