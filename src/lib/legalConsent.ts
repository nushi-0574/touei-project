export const TERMS_VERSION = '2026-11-06';
export const PRIVACY_POLICY_VERSION = '2026-11-06';

export function getLegalConsentPath(nextPath: string, extraParams: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    next: nextPath,
    terms_version: TERMS_VERSION,
    privacy_policy_version: PRIVACY_POLICY_VERSION,
    ...extraParams,
  });
  return `/auth/consent?${params.toString()}`;
}

export function getLegalConsentUrl(
  origin: string,
  nextPath: string,
  extraParams: Record<string, string> = {},
): string {
  return new URL(getLegalConsentPath(nextPath, extraParams), origin).toString();
}
