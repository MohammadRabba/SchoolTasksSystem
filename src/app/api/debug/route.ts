import { NextResponse } from "next/server";

/**
 * Public diagnostic endpoint — shows what auth/DB configuration the server sees.
 *
 * This is INTENTIONALLY PUBLIC (no auth check) so you can verify what the
 * Vercel serverless function actually receives. Safe to call anytime.
 *
 * Usage: visit https://your-app.vercel.app/api/debug in your browser.
 *
 * After debugging your production deployment, you can delete this file.
 * Or just leave it — it exposes no sensitive data (URL is masked).
 */

export async function GET() {
  const env = process.env;

  // Mask sensitive values
  const maskUrl = (url?: string) => {
    if (!url) return "(unset)";
    return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
  };

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: env.NODE_ENV || "(unset)",
    vercel: {
      isVercel: !!env.VERCEL,
      region: env.VERCEL_REGION || "(unset)",
      url: env.VERCEL_URL ? maskUrl(`https://${env.VERCEL_URL}`) : "(unset)",
      deploymentUrl: env.VERCEL_PROJECT_PRODUCTION_URL || "(unset)",
    },
    auth: {
      nextauthUrl: env.NEXTAUTH_URL ? maskUrl(env.NEXTAUTH_URL) : "(unset)",
      nextauthSecret: env.NEXTAUTH_SECRET ? `${env.NEXTAUTH_SECRET.substring(0, 6)}...(${env.NEXTAUTH_SECRET.length} chars)` : "(UNSET — auth will fail!)",
    },
    database: {
      databaseUrl: maskUrl(env.DATABASE_URL),
      isPostgres: env.DATABASE_URL?.startsWith("postgres") || env.DATABASE_URL?.startsWith("postgresql") || false,
      isSqlite: env.DATABASE_URL?.startsWith("file:") || false,
      hasSslMode: env.DATABASE_URL?.includes("sslmode=") || false,
    },
    cookies: {
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      httpOnly: true,
    },
    nextAuthVersion: "v4",
  });
}
