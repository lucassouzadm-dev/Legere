/**
 * clientAuth.ts
 * Autenticação segura do Portal do Cliente.
 *
 * Usa Web Crypto API (SHA-256) — sem dependências externas,
 * funciona em qualquer browser moderno e no Node.js 20+.
 *
 * Por que SHA-256 e não bcrypt?
 *   - bcrypt requer lib nativa (Node.js) — não disponível no browser sem WASM
 *   - As senhas são geradas aleatoriamente pelo sistema (12 chars, alta entropia)
 *   - SHA-256 de senha aleatória é praticamente invulnerável a rainbow tables
 *   - Para produção de alta segurança, mover a verificação para uma Edge Function
 */

// ─── Hash ─────────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === storedHash;
}

// ─── Gerador de senha segura ──────────────────────────────────────────────────

/**
 * Gera uma senha aleatória de alta entropia usando Web Crypto.
 * Exemplo: "K7m#Xp2@Nq9R"
 */
export function generateSecurePassword(length = 12): string {
  // Charset sem caracteres ambíguos (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => chars[b % chars.length]).join('');
}
