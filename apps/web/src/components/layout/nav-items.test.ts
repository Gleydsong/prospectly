import { describe, expect, it } from 'vitest';
import { isNavItemActive, routeTitleKey, TOOLS_NAV_ITEMS, WORKSPACE_NAV_ITEMS } from './nav-items';

describe('nav-items', () => {
  it('defines workspace and tools items matching the redesign', () => {
    expect(WORKSPACE_NAV_ITEMS.map((item) => item.to)).toEqual([
      '/',
      '/prospectar',
      '/clientes',
      '/tasks',
      '/settings',
    ]);
    expect(TOOLS_NAV_ITEMS.map((item) => item.to)).toEqual([
      '/clientes/listas',
      '/workflows',
      '/?aba=relatorios',
      '/agents',
      '/sdr',
    ]);
  });

  describe('isNavItemActive', () => {
    it('activates only "Listas" on /clientes/listas', () => {
      expect(isNavItemActive('/clientes/listas', '/clientes/listas')).toBe(true);
      expect(isNavItemActive('/clientes', '/clientes/listas')).toBe(false);
    });

    it('activates only "Listas" on /clientes/listas/list-123', () => {
      expect(isNavItemActive('/clientes/listas', '/clientes/listas/list-123')).toBe(true);
      expect(isNavItemActive('/clientes', '/clientes/listas/list-123')).toBe(false);
    });

    it('activates "Clientes" on /clientes and client detail', () => {
      expect(isNavItemActive('/clientes', '/clientes')).toBe(true);
      expect(isNavItemActive('/clientes', '/clientes/client-123')).toBe(true);
      expect(isNavItemActive('/clientes/listas', '/clientes')).toBe(false);
    });

    it('activates "Relatórios" on /?aba=relatorios and deactivates "Início"', () => {
      expect(isNavItemActive('/?aba=relatorios', '/', '?aba=relatorios')).toBe(true);
      expect(isNavItemActive('/', '/', '?aba=relatorios')).toBe(false);
    });

    it('activates "Início" on / without relatorios tab', () => {
      expect(isNavItemActive('/', '/', '')).toBe(true);
      expect(isNavItemActive('/', '/', '?aba=inicio')).toBe(true);
      expect(isNavItemActive('/?aba=relatorios', '/', '')).toBe(false);
    });
  });

  describe('routeTitleKey', () => {
    it('maps /agents to nav.agents', () => {
      expect(routeTitleKey('/agents')).toBe('nav.agents');
    });

    it('maps /?aba=relatorios to nav.reports', () => {
      expect(routeTitleKey('/', '?aba=relatorios')).toBe('nav.reports');
      expect(routeTitleKey('/', '')).toBe('nav.principal');
    });
  });
});
