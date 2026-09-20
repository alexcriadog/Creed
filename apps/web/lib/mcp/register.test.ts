import { describe, it, expect } from 'vitest';
import { tools } from './tools';
import { toToolResult, runTool, SERVER_INSTRUCTIONS } from './register';
import { McpError } from './types';

describe('registro de tools', () => {
  it('14 tools con nombres únicos y descripción en español', () => {
    expect(tools).toHaveLength(14);
    expect(new Set(tools.map((t) => t.name)).size).toBe(14);
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(60);
    }
    expect(SERVER_INSTRUCTIONS).toContain('get_daily_briefing');
  });

  it('toToolResult serializa JSON compacto', () => {
    expect(toToolResult({ a: 1, b: undefined })).toEqual({ content: [{ type: 'text', text: '{"a":1}' }] });
  });

  it('runTool convierte McpError en isError con code', async () => {
    const res = await runTool(async () => {
      throw new McpError('x', 'boom');
    });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0]!.text)).toEqual({ error: 'boom', code: 'x' });
  });

  it('runTool oculta errores inesperados', async () => {
    const res = await runTool(async () => {
      throw new Error('stack trace con secretos');
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).not.toContain('secretos');
    expect(JSON.parse(res.content[0]!.text).code).toBe('internal');
  });

  it('runTool convierte errores de validación Zod en mensajes legibles', async () => {
    const tool = tools.find((t) => t.name === 'log_meal')!;
    const res = await runTool(async () => tool.inputSchema.parse({ consumed_at: 'ayer' }));
    expect(res.isError).toBe(true);
    const body = JSON.parse(res.content[0]!.text);
    expect(body.code).toBe('invalid_input');
    expect(body.error).toMatch(/consumed_at/);
  });
});
