/** Contraseñas (scrypt con sal) y tokens de sesión. Solo `node:crypto`, sin dependencias. */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const LARGO_MINIMO_CLAVE = 8;
const LARGO_HASH = 64;

function derivar(clave: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) =>
    scrypt(clave.normalize('NFKC'), sal, LARGO_HASH, (error, hash) => (error ? rechazar(error) : resolver(hash))),
  );
}

/** "scrypt$<sal hex>$<hash hex>" */
export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${(await derivar(clave, sal)).toString('hex')}`;
}

export async function verificarClave(clave: string, guardada: string): Promise<boolean> {
  const [algoritmo, sal, hash] = guardada.split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = await derivar(clave, Buffer.from(sal, 'hex'));
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

/** Token aleatorio que va en la cookie. */
export const nuevoToken = () => randomBytes(32).toString('base64url');

/** En la base de datos solo se guarda el SHA-256 del token: si se filtra la tabla, no sirve para entrar. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
