export type ProviderId = 'motion' | 'apple-health' | 'health-connect';

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  /** Whether this provider can be used in the running build. */
  available: boolean;
  /** Whether the user has granted access (null when not applicable or unknown). */
  granted: boolean | null;
  canAskAgain: boolean;
  /** What the provider supplies in this build. */
  supplies: string[];
  /** Plain explanation shown when unavailable or limited. */
  note: string;
}

/**
 * Contract for full health-platform adapters (phase 2, development build).
 * Each read returns records with a stable `externalId` (the platform's sample UUID)
 * so imports are de-duplicated by repository.importExternal().
 */
export interface HealthPlatformAdapter {
  id: Exclude<ProviderId, 'motion'>;
  getStatus(): Promise<ProviderStatus>;
  requestPermissions(): Promise<ProviderStatus>;
  /** Imports new samples since the last sync. Returns the number of new records. */
  importSince(sinceIso: string): Promise<number>;
}
