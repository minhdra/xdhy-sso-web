export interface DiagnosticContext {
  requestId?: string;
  status?: number;
  path?: string;
  detail?: string;
}

const NAVIGATION_ID_KEY = 'xdhy_navigation_id';

export const getNavigationId = (): string => {
  const existing = sessionStorage.getItem(NAVIGATION_ID_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  sessionStorage.setItem(NAVIGATION_ID_KEY, value);
  return value;
};

export const createRequestId = (): string => crypto.randomUUID();

export const recordDiagnostic = (event: string, context: DiagnosticContext = {}): void => {
  console.info('[app-diagnostic]', {
    event,
    app: __APP_BUILD_INFO__.app,
    buildId: __APP_BUILD_INFO__.buildId,
    navigationId: getNavigationId(),
    occurredAt: new Date().toISOString(),
    ...context,
  });
};

export const appRequestHeaders = (): Record<string, string> => ({
  'X-Request-Id': createRequestId(),
  'X-Navigation-Id': getNavigationId(),
  'X-App-Version': __APP_BUILD_INFO__.buildId,
});
