import type {
  AlertRef,
  AttackPath,
  Cluster,
  ClusterId,
  Edge,
  EdgeCriticality,
  EdgeKind,
  Entity,
  EntityStatus,
  EntityType,
  GraphData,
  Severity,
  Vulnerability,
} from "./types";

// Deterministic PRNG so the demo renders identically on every load.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shared generator state, re-seeded at the start of every buildGraphData()
// call so server and client renders produce identical data.
let rand = mulberry32(1337);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export const CLUSTERS: Cluster[] = [
  { id: "identities", label: "Identities", color: "#38bdf8" },
  { id: "endpoints", label: "Endpoints", color: "#34d399" },
  { id: "servers", label: "Servers & Infra", color: "#a78bfa" },
  { id: "cloud", label: "Cloud & SaaS", color: "#fbbf24" },
  { id: "data", label: "Data Assets", color: "#f472b6" },
  { id: "alerts", label: "Alerts & Findings", color: "#f87171" },
];

const FIRST_NAMES = [
  "Ava", "Noah", "Maya", "Liam", "Tamar", "Eitan", "Zoe", "Omar",
  "Dana", "Yuri", "Nina", "Theo", "Ruth", "Igor", "Lena", "Marco",
  "Priya", "Chen", "Sara", "Jonas",
];
const LAST_NAMES = [
  "Levy", "Cohen", "Smith", "Garcia", "Tanaka", "Mizrahi", "Okafor",
  "Novak", "Kim", "Rossi", "Berg", "Adler", "Stone", "Peretz",
];

const VULN_POOL: Vulnerability[] = [
  { cve: "CVE-2025-30121", title: "OpenSSH pre-auth RCE", severity: "critical", cvss: 9.8 },
  { cve: "CVE-2025-21412", title: "Windows SmartScreen bypass", severity: "high", cvss: 8.1 },
  { cve: "CVE-2024-3400", title: "PAN-OS GlobalProtect command injection", severity: "critical", cvss: 10.0 },
  { cve: "CVE-2025-1097", title: "Chrome V8 type confusion", severity: "high", cvss: 8.8 },
  { cve: "CVE-2024-21762", title: "FortiOS out-of-bounds write", severity: "critical", cvss: 9.6 },
  { cve: "CVE-2025-0282", title: "Ivanti Connect stack overflow", severity: "critical", cvss: 9.0 },
  { cve: "CVE-2025-4571", title: "Outdated TLS configuration", severity: "medium", cvss: 5.9 },
  { cve: "CVE-2025-8810", title: "Local privilege escalation in kernel driver", severity: "high", cvss: 7.8 },
  { cve: "CVE-2025-2210", title: "SQL injection in legacy reporting module", severity: "high", cvss: 8.2 },
  { cve: "CVE-2025-0099", title: "Weak JWT signing key", severity: "medium", cvss: 6.5 },
];

const ACTIVITY_POOL = [
  "Successful sign-in from corporate network",
  "Password changed by user",
  "New OAuth consent granted to third-party app",
  "Outbound connection to rare external domain",
  "MFA challenge completed",
  "Configuration drift detected and reverted",
  "Software inventory scan completed",
  "Anomalous data transfer volume observed",
  "Privileged session started",
  "Endpoint agent heartbeat resumed after 6h gap",
  "Failed sign-in attempts from 3 countries",
  "Security patch applied",
];

const TIMES = [
  "2m ago", "18m ago", "1h ago", "3h ago", "6h ago",
  "Yesterday 22:14", "Yesterday 09:47", "2 days ago", "4 days ago",
];

let alertCounter = 100;
function makeAlert(title: string, severity: Severity): AlertRef {
  alertCounter += randInt(1, 9);
  return { id: `ALR-${alertCounter}`, title, severity };
}

function makeActivity(count: number) {
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push({ time: TIMES[Math.min(i + randInt(0, 2), TIMES.length - 1)], description: pick(ACTIVITY_POOL) });
  }
  return events;
}

interface EntitySpec {
  id: string;
  name: string;
  type: EntityType;
  cluster: ClusterId;
  status?: EntityStatus;
  criticalAsset?: boolean;
  riskScore?: number;
  description?: string;
  vulnerabilities?: Vulnerability[];
  alerts?: AlertRef[];
}

const TYPE_DESCRIPTIONS: Record<EntityType, string> = {
  user: "Workforce identity managed in Entra ID.",
  "service-account": "Non-human identity used by automated workloads.",
  admin: "Privileged identity with elevated directory rights.",
  laptop: "Corporate-managed endpoint running EDR agent.",
  mobile: "BYOD mobile device enrolled in MDM.",
  server: "On-premises server in the corporate datacenter.",
  "vpn-gateway": "Internet-facing remote access gateway.",
  "saas-app": "Third-party SaaS application integrated via SSO.",
  "cloud-workload": "Cloud compute workload (VM / container).",
  database: "Structured data store containing business records.",
  "file-share": "Network file share with departmental documents.",
  alert: "Security detection raised by the analytics pipeline.",
};

function makeEntity(spec: EntitySpec): Entity {
  const status = spec.status ?? "healthy";
  const baseRisk = status === "compromised" ? randInt(78, 95) : status === "vulnerable" ? randInt(45, 75) : randInt(3, 30);
  return {
    id: spec.id,
    name: spec.name,
    type: spec.type,
    cluster: spec.cluster,
    status,
    criticalAsset: spec.criticalAsset ?? false,
    riskScore: spec.riskScore ?? baseRisk,
    description: spec.description ?? TYPE_DESCRIPTIONS[spec.type],
    vulnerabilities:
      spec.vulnerabilities ??
      (status === "healthy" ? (rand() < 0.25 ? [pick(VULN_POOL)] : []) : [pick(VULN_POOL), pick(VULN_POOL)].filter((v, i, a) => a.findIndex((x) => x.cve === v.cve) === i)),
    activity: makeActivity(randInt(2, 4)),
    alerts: spec.alerts ?? [],
  };
}

export function buildGraphData(): GraphData {
  rand = mulberry32(1337);
  alertCounter = 100;
  const entities: Entity[] = [];
  const edges: Edge[] = [];
  let edgeCounter = 0;

  function addEdge(source: string, target: string, kind: EdgeKind, criticality: EdgeCriticality = "normal"): string {
    const id = `e${edgeCounter++}`;
    edges.push({ id, source, target, kind, criticality });
    return id;
  }

  // ---- Story entities (hand-authored, used by attack paths) ----
  const story: EntitySpec[] = [
    {
      id: "vpn-1", name: "VPN-GW-TLV-01", type: "vpn-gateway", cluster: "servers",
      status: "vulnerable", riskScore: 88,
      description: "Internet-exposed VPN gateway terminating remote-access sessions for EMEA.",
      vulnerabilities: [VULN_POOL[4], VULN_POOL[6]],
      alerts: [makeAlert("Exploit attempt against FortiOS CVE-2024-21762", "critical")],
    },
    {
      id: "lt-contractor", name: "LT-CONTRACTOR-88", type: "laptop", cluster: "endpoints",
      status: "compromised", riskScore: 93,
      description: "Unmanaged contractor laptop. Initial access via phishing attachment.",
      vulnerabilities: [VULN_POOL[3], VULN_POOL[7]],
      alerts: [
        makeAlert("Malicious macro execution detected", "critical"),
        makeAlert("C2 beaconing to known bad domain", "high"),
      ],
    },
    {
      id: "svc-backup", name: "svc-backup-prod", type: "service-account", cluster: "identities",
      status: "compromised", riskScore: 90,
      description: "Service account with broad read access to production file servers. Credentials harvested from memory.",
      vulnerabilities: [VULN_POOL[9]],
      alerts: [makeAlert("Credential theft via LSASS dump", "critical")],
    },
    {
      id: "adm-dlevy", name: "dlevy-admin", type: "admin", cluster: "identities",
      status: "vulnerable", riskScore: 81,
      description: "Domain administrator account. Session token observed on a compromised host.",
      alerts: [makeAlert("Privileged session from unusual host", "high")],
    },
    {
      id: "srv-jump", name: "JUMP-SRV-02", type: "server", cluster: "servers",
      status: "vulnerable", riskScore: 76,
      description: "Jump server bridging the user segment and the restricted datacenter VLAN.",
      vulnerabilities: [VULN_POOL[0]],
      alerts: [makeAlert("Lateral movement via RDP detected", "high")],
    },
    {
      id: "db-customers", name: "CUSTOMER-DB-PROD", type: "database", cluster: "data",
      status: "healthy", criticalAsset: true, riskScore: 71,
      description: "Production PostgreSQL cluster holding 4.2M customer records (PII).",
      vulnerabilities: [VULN_POOL[8]],
    },
    {
      id: "db-finance", name: "FINANCE-DB-01", type: "database", cluster: "data",
      status: "healthy", criticalAsset: true, riskScore: 64,
      description: "Financial ERP database. Quarterly close data, payment instructions.",
    },
    {
      id: "fs-legal", name: "FS-LEGAL-SHARE", type: "file-share", cluster: "data",
      status: "healthy", criticalAsset: true, riskScore: 52,
      description: "Legal department file share containing contracts and M&A material.",
    },
    {
      id: "app-crm", name: "Salesforce CRM", type: "saas-app", cluster: "cloud",
      status: "healthy", criticalAsset: true, riskScore: 41,
      description: "Primary CRM. SSO-integrated; holds full customer pipeline.",
    },
    {
      id: "cw-payments", name: "payments-api (k8s)", type: "cloud-workload", cluster: "cloud",
      status: "vulnerable", riskScore: 69,
      description: "Payment processing API running on the production Kubernetes cluster.",
      vulnerabilities: [VULN_POOL[9], VULN_POOL[6]],
    },
    {
      id: "u-okafor", name: "Adaeze Okafor", type: "user", cluster: "identities",
      status: "vulnerable", riskScore: 58,
      description: "Finance analyst. Recently targeted by a credential phishing campaign.",
      alerts: [makeAlert("Clicked link in confirmed phishing email", "medium")],
    },
  ];

  // Story alerts as graph entities in the Alerts cluster
  const storyAlerts: EntitySpec[] = [
    {
      id: "al-phish", name: "Phishing payload executed", type: "alert", cluster: "alerts",
      status: "compromised", riskScore: 92,
      description: "EDR detection: malicious macro spawned PowerShell on LT-CONTRACTOR-88.",
    },
    {
      id: "al-cred", name: "Credential theft (LSASS)", type: "alert", cluster: "alerts",
      status: "compromised", riskScore: 90,
      description: "Memory access to LSASS consistent with Mimikatz; svc-backup-prod credentials exposed.",
    },
    {
      id: "al-lateral", name: "Lateral movement via RDP", type: "alert", cluster: "alerts",
      status: "compromised", riskScore: 85,
      description: "Interactive RDP from user segment to JUMP-SRV-02 using stolen credentials.",
    },
    {
      id: "al-vpn", name: "VPN exploit attempt", type: "alert", cluster: "alerts",
      status: "vulnerable", riskScore: 80,
      description: "Signature match for CVE-2024-21762 exploitation against VPN-GW-TLV-01.",
    },
  ];

  for (const spec of [...story, ...storyAlerts]) entities.push(makeEntity(spec));

  // ---- Generated population ----
  const usedNames = new Set<string>();
  function personName(): string {
    for (;;) {
      const n = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  }

  const users: string[] = [];
  for (let i = 0; i < 26; i++) {
    const id = `u-${i}`;
    users.push(id);
    entities.push(makeEntity({ id, name: personName(), type: "user", cluster: "identities", status: rand() < 0.12 ? "vulnerable" : "healthy" }));
  }
  const admins: string[] = ["adm-dlevy"];
  for (let i = 0; i < 3; i++) {
    const id = `adm-${i}`;
    admins.push(id);
    entities.push(makeEntity({ id, name: `${personName()} (admin)`, type: "admin", cluster: "identities" }));
  }
  const svcAccounts: string[] = ["svc-backup"];
  for (let i = 0; i < 5; i++) {
    const id = `svc-${i}`;
    svcAccounts.push(id);
    entities.push(makeEntity({ id, name: `svc-${pick(["ci", "etl", "scan", "sync", "mon", "iam"])}-${randInt(1, 9)}`, type: "service-account", cluster: "identities" }));
  }

  const laptops: string[] = ["lt-contractor"];
  for (let i = 0; i < 22; i++) {
    const id = `lt-${i}`;
    laptops.push(id);
    entities.push(makeEntity({ id, name: `LT-${1000 + i}`, type: "laptop", cluster: "endpoints", status: rand() < 0.15 ? "vulnerable" : "healthy" }));
  }
  const mobiles: string[] = [];
  for (let i = 0; i < 8; i++) {
    const id = `mb-${i}`;
    mobiles.push(id);
    entities.push(makeEntity({ id, name: `MOB-${2000 + i}`, type: "mobile", cluster: "endpoints" }));
  }

  const servers: string[] = ["srv-jump", "vpn-1"];
  const serverRoles = ["WEB", "APP", "DC", "PRINT", "BUILD", "MAIL", "PROXY", "DNS", "SCCM", "NAS", "ERP", "MON"];
  for (let i = 0; i < 14; i++) {
    const id = `srv-${i}`;
    servers.push(id);
    entities.push(makeEntity({ id, name: `${serverRoles[i % serverRoles.length]}-SRV-${randInt(1, 30)}`, type: "server", cluster: "servers", status: rand() < 0.2 ? "vulnerable" : "healthy" }));
  }

  const cloudApps: string[] = ["app-crm", "cw-payments"];
  const saasNames = ["Workday HR", "Slack", "GitHub Enterprise", "Jira Cloud", "Okta", "Zoom", "DocuSign", "Snowflake"];
  for (let i = 0; i < saasNames.length; i++) {
    const id = `app-${i}`;
    cloudApps.push(id);
    entities.push(makeEntity({ id, name: saasNames[i], type: "saas-app", cluster: "cloud", criticalAsset: saasNames[i] === "Okta" || saasNames[i] === "Snowflake" }));
  }
  const workloadNames = ["auth-svc (k8s)", "web-frontend (k8s)", "etl-runner (vm)", "ml-inference (vm)", "logging-stack (k8s)", "cache-tier (k8s)"];
  for (let i = 0; i < workloadNames.length; i++) {
    const id = `cw-${i}`;
    cloudApps.push(id);
    entities.push(makeEntity({ id, name: workloadNames[i], type: "cloud-workload", cluster: "cloud", status: rand() < 0.2 ? "vulnerable" : "healthy" }));
  }

  const dataAssets: string[] = ["db-customers", "db-finance", "fs-legal"];
  const dataNames: Array<[string, EntityType]> = [
    ["HR-DB-01", "database"], ["ANALYTICS-WH", "database"], ["DEV-DB-03", "database"],
    ["FS-ENG-SHARE", "file-share"], ["FS-MARKETING", "file-share"], ["FS-BACKUPS", "file-share"], ["LOGS-ARCHIVE", "file-share"],
  ];
  for (let i = 0; i < dataNames.length; i++) {
    const id = `da-${i}`;
    dataAssets.push(id);
    entities.push(makeEntity({ id, name: dataNames[i][0], type: dataNames[i][1], cluster: "data", criticalAsset: dataNames[i][0] === "HR-DB-01" }));
  }

  const alertEnts: string[] = ["al-phish", "al-cred", "al-lateral", "al-vpn"];
  const alertNames: Array<[string, Severity]> = [
    ["Impossible travel sign-in", "medium"],
    ["Excessive OAuth scopes granted", "medium"],
    ["Outdated EDR agent fleet-wide", "low"],
    ["Public S3 bucket exposure", "high"],
    ["Brute force against Okta", "high"],
    ["Anomalous data egress", "high"],
    ["Stale admin account active", "medium"],
    ["Unpatched critical CVE on 12 hosts", "critical"],
  ];
  for (let i = 0; i < alertNames.length; i++) {
    const id = `al-${i}`;
    alertEnts.push(id);
    const sev = alertNames[i][1];
    entities.push(makeEntity({
      id, name: alertNames[i][0], type: "alert", cluster: "alerts",
      status: sev === "critical" || sev === "high" ? "vulnerable" : "healthy",
      riskScore: sev === "critical" ? randInt(80, 95) : sev === "high" ? randInt(60, 79) : randInt(25, 55),
    }));
  }

  // ---- Story edges (attack-path backbone) ----
  // Ids captured so fixes and the incident replay can reference them.
  const E = {
    okaforToLaptop: addEdge("u-okafor", "lt-contractor", "communicates_with", "risky"),
    laptopToVpn: addEdge("lt-contractor", "vpn-1", "authenticates_to", "attack"),
    laptopToSvc: addEdge("lt-contractor", "svc-backup", "affected_by", "attack"),
    svcToJump: addEdge("svc-backup", "srv-jump", "authenticates_to", "attack"),
    jumpToCustomers: addEdge("srv-jump", "db-customers", "has_access_to", "attack"),
    admToJump: addEdge("adm-dlevy", "srv-jump", "admin_of", "risky"),
    admToFinance: addEdge("adm-dlevy", "db-finance", "has_access_to", "risky"),
    vpnToJump: addEdge("vpn-1", "srv-jump", "communicates_with", "risky"),
    okaforToFinance: addEdge("u-okafor", "db-finance", "has_access_to", "risky"),
    okaforToCrm: addEdge("u-okafor", "app-crm", "authenticates_to", "normal"),
    paymentsToCustomers: addEdge("cw-payments", "db-customers", "has_access_to", "risky"),
    paymentsToFinance: addEdge("cw-payments", "db-finance", "communicates_with", "normal"),
    svcToLegal: addEdge("svc-backup", "fs-legal", "has_access_to", "risky"),
    svcToBackups: addEdge("svc-backup", "da-5", "has_access_to", "normal"), // FS-BACKUPS
  };

  // Alerts attached to affected entities
  const EA = {
    phishToLaptop: addEdge("al-phish", "lt-contractor", "affected_by", "attack"),
    credToSvc: addEdge("al-cred", "svc-backup", "affected_by", "attack"),
    lateralToJump: addEdge("al-lateral", "srv-jump", "affected_by", "attack"),
    vpnAlert: addEdge("al-vpn", "vpn-1", "affected_by", "risky"),
  };
  addEdge("al-4", "app-2", "affected_by", "risky"); // brute force -> Okta-ish
  addEdge("al-3", "cw-2", "affected_by", "risky");
  addEdge("al-5", "da-1", "affected_by", "risky");
  addEdge("al-7", "srv-3", "affected_by", "risky");

  // ---- Generated edges ----
  const linked = new Set(edges.map((e) => `${e.source}|${e.target}`));
  function tryEdge(source: string, target: string, kind: EdgeKind, criticality: EdgeCriticality = "normal") {
    if (source === target) return;
    if (linked.has(`${source}|${target}`) || linked.has(`${target}|${source}`)) return;
    linked.add(`${source}|${target}`);
    addEdge(source, target, kind, criticality);
  }

  // Users own endpoints and use SaaS apps
  for (let i = 0; i < users.length; i++) {
    const device = i < laptops.length ? laptops[i % laptops.length] : pick(mobiles);
    tryEdge(users[i], device, "communicates_with");
    tryEdge(users[i], pick(cloudApps), "authenticates_to");
    if (rand() < 0.4) tryEdge(users[i], pick(cloudApps), "authenticates_to");
    if (rand() < 0.3) tryEdge(users[i], pick(dataAssets), "has_access_to", rand() < 0.2 ? "risky" : "normal");
  }
  for (const m of mobiles) tryEdge(pick(users), m, "communicates_with");

  // Endpoints reach servers / VPN
  for (const lt of laptops) {
    tryEdge(lt, pick(servers), "communicates_with");
    if (rand() < 0.35) tryEdge(lt, "vpn-1", "authenticates_to");
  }

  // Admins administer servers; service accounts touch servers & data
  for (const a of admins) {
    tryEdge(a, pick(servers), "admin_of", rand() < 0.3 ? "risky" : "normal");
    tryEdge(a, pick(servers), "admin_of");
  }
  for (const s of svcAccounts) {
    tryEdge(s, pick(servers), "authenticates_to");
    tryEdge(s, pick(dataAssets), "has_access_to", rand() < 0.25 ? "risky" : "normal");
  }

  // Server <-> server, server <-> data, cloud <-> data
  for (let i = 0; i < 12; i++) tryEdge(pick(servers), pick(servers), "communicates_with");
  for (let i = 0; i < 8; i++) tryEdge(pick(servers), pick(dataAssets), "has_access_to");
  for (let i = 0; i < 8; i++) tryEdge(pick(cloudApps), pick(cloudApps), "communicates_with");
  for (let i = 0; i < 5; i++) tryEdge(pick(cloudApps), pick(dataAssets), "has_access_to", rand() < 0.3 ? "risky" : "normal");

  const attackPaths: AttackPath[] = [
    {
      id: "ap-1",
      name: "Phished contractor → Customer DB",
      description:
        "Phishing payload on an unmanaged contractor laptop harvested service-account credentials, enabling lateral movement through the jump server to the production customer database (4.2M PII records).",
      nodeIds: ["lt-contractor", "svc-backup", "srv-jump", "db-customers"],
      hopCaptions: [
        "Initial access: a phishing attachment executes a malicious macro on the unmanaged contractor laptop.",
        "Credential theft: LSASS memory is dumped, exposing the svc-backup-prod service-account credentials.",
        "Lateral movement: the stolen credential opens an RDP session to the jump server bridging into the datacenter VLAN.",
        "Objective: the jump server has standing access to CUSTOMER-DB-PROD — 4.2M customer records reachable.",
      ],
    },
    {
      id: "ap-2",
      name: "Internet-exposed VPN → Finance DB",
      description:
        "Unpatched VPN gateway (CVE-2024-21762) allows pre-auth code execution; an attacker can pivot to the jump server where a domain-admin session token is exposed, granting access to the finance database.",
      nodeIds: ["vpn-1", "srv-jump", "adm-dlevy", "db-finance"],
      hopCaptions: [
        "Entry point: CVE-2024-21762 allows pre-auth remote code execution on the internet-facing VPN gateway.",
        "Pivot: the gateway has a network path to the jump server inside the perimeter.",
        "Privilege escalation: a domain-admin session token (dlevy-admin) is exposed on the jump server.",
        "Objective: the admin account holds standing access to FINANCE-DB-01 — payment instructions at risk.",
      ],
    },
    {
      id: "ap-3",
      name: "Compromised service account → Legal share",
      description:
        "The stolen svc-backup-prod credential has standing read access to the legal department file share containing M&A material — direct exfiltration risk with no further exploitation required.",
      nodeIds: ["lt-contractor", "svc-backup", "fs-legal"],
      hopCaptions: [
        "Foothold: the compromised contractor laptop already runs attacker code.",
        "Stolen identity: the harvested svc-backup-prod credential is valid and unrotated.",
        "Objective: that credential has standing read access to FS-LEGAL-SHARE — M&A material can be exfiltrated with no further exploit.",
      ],
    },
  ];

  // ---- Remediation fixes (ranked live by paths severed) ----
  const fixes = [
    {
      id: "fix-svc",
      title: "Rotate svc-backup-prod credentials",
      description:
        "Rotate the harvested service-account credential and revoke its standing access. Removes the stolen identity from every path that uses it.",
      targetEntityId: "svc-backup",
      severedEdgeIds: [E.laptopToSvc, E.svcToJump, E.svcToLegal],
      severedPathIds: ["ap-1", "ap-3"],
      riskDelta: 18,
    },
    {
      id: "fix-contractor",
      title: "Isolate LT-CONTRACTOR-88",
      description:
        "Network-contain the compromised contractor laptop. Cuts the attacker's foothold at the source.",
      targetEntityId: "lt-contractor",
      severedEdgeIds: [E.okaforToLaptop, E.laptopToVpn, E.laptopToSvc],
      severedPathIds: ["ap-1", "ap-3"],
      riskDelta: 16,
    },
    {
      id: "fix-jump",
      title: "Enforce MFA + tiering on JUMP-SRV-02",
      description:
        "Require step-up MFA for jump-server sessions and remove its standing route to production databases. The jump server is the choke point of two paths.",
      targetEntityId: "srv-jump",
      severedEdgeIds: [E.svcToJump, E.jumpToCustomers, E.admToJump],
      severedPathIds: ["ap-1", "ap-2"],
      riskDelta: 15,
    },
    {
      id: "fix-vpn",
      title: "Patch CVE-2024-21762 on VPN-GW-TLV-01",
      description:
        "Apply the FortiOS patch closing the pre-auth RCE on the internet-facing gateway.",
      targetEntityId: "vpn-1",
      severedEdgeIds: [E.vpnToJump, E.laptopToVpn],
      severedPathIds: ["ap-2"],
      riskDelta: 12,
    },
    {
      id: "fix-admin",
      title: "Clear dlevy-admin session on jump server",
      description:
        "Invalidate the exposed domain-admin session token and move the account to a privileged-access workstation.",
      targetEntityId: "adm-dlevy",
      severedEdgeIds: [E.admToJump, E.admToFinance],
      severedPathIds: ["ap-2"],
      riskDelta: 9,
    },
  ];

  // ---- Toxic combinations (minor issues that chain into critical exposure) ----
  const toxicCombos = [
    {
      id: "tc-1",
      name: "Public API → Customer PII",
      explanation:
        "Three medium findings chain: an internet-reachable workload, a weak JWT signing key, and standing access to the customer database. Each alone is backlog material; together they are a breach path.",
      anchorId: "cw-payments",
      nodeIds: ["cw-payments", "db-customers"],
      ingredients: [
        "payments-api is reachable from the internet (medium)",
        "CVE-2025-0099 — weak JWT signing key (medium, CVSS 6.5)",
        "Workload has standing access to CUSTOMER-DB-PROD (risky edge)",
      ],
    },
    {
      id: "tc-2",
      name: "Phish target → Finance DB",
      explanation:
        "A user who clicked a confirmed phishing link holds direct, un-stepped access to the finance database. One successful credential phish becomes financial-data exposure.",
      anchorId: "u-okafor",
      nodeIds: ["u-okafor", "db-finance"],
      ingredients: [
        "Confirmed phishing click in the last 7 days (medium)",
        "Direct has-access-to edge to FINANCE-DB-01 (risky)",
        "No step-up MFA required for database access (low)",
      ],
    },
    {
      id: "tc-3",
      name: "Admin session on shared host",
      explanation:
        "A domain-admin session token sits on a multi-user jump server that lower-trust identities can reach. Anyone who lands on that host inherits a path to domain admin and the finance database.",
      anchorId: "adm-dlevy",
      nodeIds: ["adm-dlevy", "srv-jump", "db-finance"],
      ingredients: [
        "Privileged session from a non-PAW host (medium)",
        "Jump server reachable from the user segment (low)",
        "Admin account has standing access to FINANCE-DB-01 (risky)",
      ],
    },
  ];

  // ---- Incident replay (the ap-1 breach as a timeline) ----
  const incident = {
    id: "inc-1",
    name: "Contractor laptop breach — replay",
    steps: [
      {
        time: "09:12",
        title: "Phishing email opened",
        description: "Adaeze Okafor forwards a vendor invoice to the contractor; the attachment carries a malicious macro.",
        revealNodeIds: ["u-okafor", "lt-contractor"],
        revealEdgeIds: [E.okaforToLaptop],
      },
      {
        time: "09:14",
        title: "Malicious macro executes",
        description: "EDR raises an alert: the macro spawns PowerShell on LT-CONTRACTOR-88. Initial access established.",
        revealNodeIds: ["al-phish"],
        revealEdgeIds: [EA.phishToLaptop],
      },
      {
        time: "09:51",
        title: "Credentials harvested",
        description: "LSASS memory is dumped (Mimikatz pattern). The svc-backup-prod service-account credential is now in attacker hands.",
        revealNodeIds: ["svc-backup", "al-cred"],
        revealEdgeIds: [E.laptopToSvc, EA.credToSvc],
      },
      {
        time: "11:22",
        title: "Lateral movement via RDP",
        description: "The stolen credential opens an interactive RDP session to JUMP-SRV-02, crossing into the datacenter VLAN.",
        revealNodeIds: ["srv-jump", "al-lateral"],
        revealEdgeIds: [E.svcToJump, EA.lateralToJump],
      },
      {
        time: "13:05",
        title: "Customer DB reached",
        description: "The jump server's standing access is used to query CUSTOMER-DB-PROD. 4.2M records exposed; containment begins.",
        revealNodeIds: ["db-customers"],
        revealEdgeIds: [E.jumpToCustomers],
      },
    ],
  };

  // ---- 90-day posture trend (seeded walk ending at a fixed live baseline) ----
  const trendRand = mulberry32(4242);
  const riskTrend: number[] = [];
  let level = 84;
  for (let i = 0; i < 89; i++) {
    riskTrend.push(Math.round(level));
    level += (trendRand() - 0.52) * 2.6;
    level = Math.max(55, Math.min(95, level));
  }

  return { clusters: CLUSTERS, entities, edges, attackPaths, fixes, toxicCombos, incident, riskTrend };
}

export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  communicates_with: "communicates with",
  has_access_to: "has access to",
  admin_of: "is admin of",
  authenticates_to: "authenticates to",
  affected_by: "affects",
};
