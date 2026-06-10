export type ClusterId =
  | "identities"
  | "endpoints"
  | "servers"
  | "cloud"
  | "data"
  | "alerts";

export type EntityType =
  | "user"
  | "service-account"
  | "admin"
  | "laptop"
  | "mobile"
  | "server"
  | "vpn-gateway"
  | "saas-app"
  | "cloud-workload"
  | "database"
  | "file-share"
  | "alert";

export type EntityStatus = "healthy" | "vulnerable" | "compromised";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Vulnerability {
  cve: string;
  title: string;
  severity: Severity;
  cvss: number;
}

export interface ActivityEvent {
  time: string;
  description: string;
}

export interface AlertRef {
  id: string;
  title: string;
  severity: Severity;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  cluster: ClusterId;
  status: EntityStatus;
  criticalAsset: boolean;
  riskScore: number; // 0-100
  description: string;
  vulnerabilities: Vulnerability[];
  activity: ActivityEvent[];
  alerts: AlertRef[];
}

export type EdgeKind =
  | "communicates_with"
  | "has_access_to"
  | "admin_of"
  | "authenticates_to"
  | "affected_by";

export type EdgeCriticality = "normal" | "risky" | "attack";

export interface Edge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  criticality: EdgeCriticality;
}

export interface Cluster {
  id: ClusterId;
  label: string;
  color: string; // base hex color for the cluster
}

export interface AttackPath {
  id: string;
  name: string;
  description: string;
  nodeIds: string[]; // ordered hops
}

export interface GraphData {
  clusters: Cluster[];
  entities: Entity[];
  edges: Edge[];
  attackPaths: AttackPath[];
}

export interface NodePosition {
  x: number;
  y: number;
}
