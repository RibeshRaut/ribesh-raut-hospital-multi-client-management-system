import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('landing/register subscription messaging consistency', () => {
  it('uses 30-day trial copy in landing and register pages', () => {
    const landing = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');
    const register = readFileSync(join(process.cwd(), 'app/register/page.tsx'), 'utf8');

    expect(landing).toContain('30-day free trial');
    expect(register).toContain('30-day free trial included');

    expect(landing).not.toContain('14-day free trial');
    expect(register).not.toContain('14-day free trial included');
  });

  it('exposes public plan labels consistent with backend plans', () => {
    const landing = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');

    expect(landing).toContain('name: "Basic"');
    expect(landing).toContain('name: "Professional"');
    expect(landing).toContain('name: "Enterprise"');
  });
});
