export function isHubAccountRoute(pathname: string): boolean {
  return pathname === "/hub/account" || pathname.startsWith("/hub/account/");
}
