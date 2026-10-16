import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLastWorkspaceId,
  forgetLastWorkspaceId,
  pickWorkspaceId,
  readLastWorkspaceId,
  workspaceHomePath,
  workspaceIdFromPath,
  writeLastWorkspaceId,
} from './lastWorkspace';

const memory = new Map<string, string>();

describe('last workspace', () => {
  afterEach(() => {
    memory.clear();
    vi.unstubAllGlobals();
  });

  it('keeps a remembered workspace only when the user still belongs to it', () => {
    const workspaces = [{ id: 'alpha' }, { id: 'beta' }];
    expect(pickWorkspaceId(workspaces, 'beta')).toBe('beta');
    expect(pickWorkspaceId(workspaces, 'missing')).toBe('alpha');
    expect(pickWorkspaceId([], 'alpha')).toBeNull();
  });

  it('stores and forgets the last workspace for one user', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => memory.set(key, value),
        removeItem: (key: string) => memory.delete(key),
      },
    });

    writeLastWorkspaceId('user-1', 'alpha');
    expect(readLastWorkspaceId('user-1')).toBe('alpha');
    expect(readLastWorkspaceId('user-2')).toBeNull();
    forgetLastWorkspaceId('user-1', 'other');
    expect(readLastWorkspaceId('user-1')).toBe('alpha');
    forgetLastWorkspaceId('user-1', 'alpha');
    expect(readLastWorkspaceId('user-1')).toBeNull();
    writeLastWorkspaceId('user-1', 'beta');
    clearLastWorkspaceId('user-1');
    expect(readLastWorkspaceId('user-1')).toBeNull();
  });

  it('reads the open workspace from workspace and activity paths', () => {
    expect(workspaceIdFromPath('/workspaces')).toBeNull();
    expect(workspaceIdFromPath('/workspaces/resume')).toBeNull();
    expect(workspaceIdFromPath('/workspaces/alpha')).toBe('alpha');
    expect(workspaceIdFromPath('/workspaces/alpha/projects/launch')).toBe('alpha');
    expect(workspaceIdFromPath('/activity/alpha/launch')).toBe('alpha');
    expect(workspaceIdFromPath('/dashboard')).toBeNull();
    expect(workspaceHomePath('alpha')).toBe('/workspaces/alpha');
    expect(workspaceHomePath(null)).toBe('/workspaces');
  });
});