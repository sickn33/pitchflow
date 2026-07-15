export const PUBLIC_SITE_ORIGIN = "https://pitchflow-ten.vercel.app" as const;
export const LOCAL_SITE_ORIGIN = "http://localhost:3210" as const;

type MetadataEnvironment = Readonly<{
  NODE_ENV?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}>;

/**
 * Production metadata is pinned to the public viewer origin and never derived
 * from request headers. Development retains the explicit local override used
 * by the one-command launcher, with localhost as its deterministic fallback.
 */
export function resolveMetadataBase(environment: MetadataEnvironment = process.env): URL {
  if (environment.NODE_ENV === "production") {
    return new URL(PUBLIC_SITE_ORIGIN);
  }

  const localOrigin = new URL(environment.NEXT_PUBLIC_SITE_URL ?? LOCAL_SITE_ORIGIN);
  if (localOrigin.protocol !== "http:" && localOrigin.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.");
  }
  return localOrigin;
}
