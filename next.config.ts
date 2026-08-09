import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Reuse the client-side RSC cache for dynamic pages (dashboard, log,
    // history) for 30s so switching tabs doesn't refetch every time.
    // Server Actions already call revalidatePath on every mutation, so a
    // real data change busts this immediately regardless of the timer.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
