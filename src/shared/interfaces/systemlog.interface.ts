export type ActorType = "user" | "system" | "api" | "cron";

export type ServiceType =
  | "nginx"
  | "cloudflare"
  | "proxmox"
  | "torrent"
  | "game-server"
  | "auth"
  | string;

export interface SystemLogDTO<TMetadata = Record<string, unknown>> {
  timestamp: Date;
  service: ServiceType;
  action: string;

  actor: {
    type: ActorType;
    id?: string; // e.g., "user-123", "system-backup", "api-key-xyz"
    displayName?: string;
    ip?: string; // anonymized or hashed if needed
  };

  target?: {
    type: string;  // e.g., "vm", "nginx", "torrent"
    id: string;
    name?: string; // human-readable label
  };
  metadata: TMetadata;
}
