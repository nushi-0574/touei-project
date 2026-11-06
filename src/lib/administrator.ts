export const CHIEF_ADMINISTRATOR_EMAIL = 'reimari.nusi@gmail.com';

export function isChiefAdministratorEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === CHIEF_ADMINISTRATOR_EMAIL;
}
