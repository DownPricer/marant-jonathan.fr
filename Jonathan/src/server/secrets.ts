const MIN_SESSION_SECRET_LEN = 32;
const MIN_ADMIN_PASSWORD_LEN = 12;

export function assertRuntimeSecrets(): void {
  const password = process.env.ADMIN_PASSWORD?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();

  if (!password) {
    throw new Error('ADMIN_PASSWORD est obligatoire. Définissez-le dans .env (non versionné).');
  }
  if (password.length < MIN_ADMIN_PASSWORD_LEN) {
    throw new Error(`ADMIN_PASSWORD trop court (minimum ${MIN_ADMIN_PASSWORD_LEN} caractères).`);
  }
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET est obligatoire. Définissez-le dans .env (non versionné).');
  }
  if (sessionSecret.length < MIN_SESSION_SECRET_LEN) {
    throw new Error(`SESSION_SECRET trop court (minimum ${MIN_SESSION_SECRET_LEN} caractères).`);
  }
}
