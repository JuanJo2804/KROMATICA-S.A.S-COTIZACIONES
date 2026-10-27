import { describe, expect, it } from 'vitest';
import { cifrarClave, hashToken, nuevoToken, verificarClave } from './claves.js';
import { leerCookieSesion } from './cookie.js';

describe('contraseñas y sesiones', () => {
  it('cifra con sal (dos hashes distintos) y verifica solo la contraseña correcta', async () => {
    const a = await cifrarClave('una clave larga');
    const b = await cifrarClave('una clave larga');
    expect(a).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(a).not.toBe(b);
    expect(await verificarClave('una clave larga', a)).toBe(true);
    expect(await verificarClave('una clave larg', a)).toBe(false);
    expect(await verificarClave('una clave larga', 'texto-sin-formato')).toBe(false);
  });

  it('genera tokens distintos y guarda solo su hash', () => {
    const token = nuevoToken();
    expect(token).not.toBe(nuevoToken());
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it('lee la cookie de sesión entre otras cookies', () => {
    expect(leerCookieSesion('tema=oscuro; kromatica_sesion=abc%3D123; otra=1')).toBe('abc=123');
    expect(leerCookieSesion('tema=oscuro')).toBeNull();
    expect(leerCookieSesion(undefined)).toBeNull();
  });
});
