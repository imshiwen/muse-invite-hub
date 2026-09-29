export const SITE_URL = "https://museinvitehub.org";
export const SITE_NAME = "Muse Invite Hub";
export const SUPPORT = "support@museinvitehub.org";
export const publicPaths = [
  "/",
  "/share",
  "/redeem",
  "/how-to-register",
  "/region-limits",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
];
export const isLocal = () => process.env.APP_ENV === "local";
export const isProductionSite = () => process.env.APP_ENV === "production";
export const configured = () =>
  Boolean(process.env.DATABASE_URL || (isLocal() && process.env.LOCAL_DB_URL));
