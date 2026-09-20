import { describe, it, expect } from 'vitest';
import { safeNext, withNext } from './safe-next';

describe('safeNext', () => {
  it('acepta rutas internas', () => {
    expect(safeNext('/oauth/consent?authorization_id=abc')).toBe('/oauth/consent?authorization_id=abc');
  });
  it('rechaza externas, protocol-relative, vacías y backslashes', () => {
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext('/\\evil.com')).toBeNull();
  });
});

describe('withNext', () => {
  it('añade next codificado respetando query existente', () => {
    expect(withNext('/login', '/a?b=1')).toBe('/login?next=%2Fa%3Fb%3D1');
    expect(withNext('/verify?email=x%40y.com', '/a')).toBe('/verify?email=x%40y.com&next=%2Fa');
    expect(withNext('/login', 'https://evil.com')).toBe('/login');
  });
});
