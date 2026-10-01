import { recordDiagnostic } from './diagnostics';

export interface AppVersion {
  app: string;
  version: string;
  buildId: string;
  builtAt: string;
}

export const getServerVersion = async (): Promise<AppVersion> => {
  const response = await fetch(`/version.json?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`Version endpoint returned ${response.status}`);
  return response.json() as Promise<AppVersion>;
};

export const recordVersionCheckFailure = (error: unknown): void => {
  recordDiagnostic('version_check_failed', {
    detail: error instanceof Error ? error.message : 'unknown',
  });
};

