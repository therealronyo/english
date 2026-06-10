import type { EntityStatus, EntityType, Severity } from "./types";

export const STATUS_COLORS: Record<EntityStatus, string> = {
  healthy: "#34d399",
  vulnerable: "#fbbf24",
  compromised: "#f87171",
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  low: "#38bdf8",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f87171",
};

export const SEVERITY_ORDER: Severity[] = ["low", "medium", "high", "critical"];

export function riskToSeverity(score: number): Severity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export const TYPE_LABELS: Record<EntityType, string> = {
  user: "User",
  "service-account": "Service Account",
  admin: "Admin",
  laptop: "Laptop",
  mobile: "Mobile Device",
  server: "Server",
  "vpn-gateway": "VPN Gateway",
  "saas-app": "SaaS App",
  "cloud-workload": "Cloud Workload",
  database: "Database",
  "file-share": "File Share",
  alert: "Alert",
};

// Simple glyph paths in a 24x24 viewBox, rendered inside graph nodes and lists.
export const ICON_PATHS: Record<EntityType, string> = {
  user: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.9 0-7 2-7 4.5V20h14v-1.5c0-2.5-3.1-4.5-7-4.5Z",
  admin: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5Zm0 4a2.5 2.5 0 1 1-2.5 2.5A2.5 2.5 0 0 1 12 6Zm0 11.5c-2 0-3.8-.9-4.6-2.3.8-1.5 2.6-2.4 4.6-2.4s3.8.9 4.6 2.4c-.8 1.4-2.6 2.3-4.6 2.3Z",
  "service-account": "M12 2a4 4 0 1 0 4 4 4 4 0 0 0-4-4Zm7 14.5-1.6-.4a5.6 5.6 0 0 0-.5-1.2l.9-1.4-1.3-1.3-1.4.9a5.6 5.6 0 0 0-1.2-.5L13.5 11h-1.9l-.4 1.6a5.6 5.6 0 0 0-1.2.5l-1.4-.9-1.3 1.3.9 1.4a5.6 5.6 0 0 0-.5 1.2L6 16.5v1.9l1.6.4a5.6 5.6 0 0 0 .5 1.2l-.9 1.4 1.3 1.3 1.4-.9c.4.2.8.4 1.2.5l.4 1.6h1.9l.4-1.6c.4-.1.8-.3 1.2-.5l1.4.9 1.3-1.3-.9-1.4c.2-.4.4-.8.5-1.2l1.6-.4Zm-6.5 3a2 2 0 1 1 2-2 2 2 0 0 1-2 2Z",
  laptop: "M4 5h16v10H4Zm-2 12h20l-2 3H4Z",
  mobile: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm4 17.5a1 1 0 1 0-1-1 1 1 0 0 0 1 1Z",
  server: "M4 3h16v6H4Zm0 9h16v6H4Zm3-6.5A1.5 1.5 0 1 0 5.5 4 1.5 1.5 0 0 0 7 5.5Zm0 9A1.5 1.5 0 1 0 5.5 13 1.5 1.5 0 0 0 7 14.5Z",
  "vpn-gateway": "M12 2 3 6v5c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V6Zm0 6a3 3 0 0 1 3 3v1h1v6H8v-6h1v-1a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v1h2v-1a1 1 0 0 0-1-1Z",
  "saas-app": "M17.5 19H6a4 4 0 0 1-.6-8A6 6 0 0 1 17 8.5 4.5 4.5 0 0 1 17.5 19Z",
  "cloud-workload": "M5 5h6v6H5Zm8 0h6v6h-6Zm-8 8h6v6H5Zm8 0h6v6h-6Z",
  database: "M12 3c-4.4 0-8 1.3-8 3v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3Zm0 4c-3.5 0-6-.9-6-1s2.5-1 6-1 6 .9 6 1-2.5 1-6 1Z",
  "file-share": "M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8Z",
  alert: "M12 2 1 21h22Zm0 6.5 1 7h-2Zm0 9a1.3 1.3 0 1 1-1.3 1.3A1.3 1.3 0 0 1 12 17.5Z",
};
