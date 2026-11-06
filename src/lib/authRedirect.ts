const AUTH_REDIRECT_ORIGIN = 'https://toei-portal.invalid';

export function getAuthRedirectPath(search: string): string {
  const requestedPath = new URLSearchParams(search).get('next');
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//')) {
    return '/dashboard';
  }

  try {
    const url = new URL(requestedPath, AUTH_REDIRECT_ORIGIN);
    if (url.origin !== AUTH_REDIRECT_ORIGIN) return '/dashboard';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/dashboard';
  }
}

export function getAuthPageHref(path: string, search: string): string {
  if (!new URLSearchParams(search).has('next')) return path;
  return `${path}?next=${encodeURIComponent(getAuthRedirectPath(search))}`;
}
