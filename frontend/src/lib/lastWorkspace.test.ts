import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLastWorkspaceId,
  forgetLastWorkspaceId,
  pickWorkspaceId,
  readLastWorkspaceId,
  workspaceActivityPath,
  workspaceHomePath,
  workspaceIdFromPath,
  workspaceMembersPath,
  workspaceProjectsPath,
  workspaceSectionPath,
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
    expect(workspaceProjectsPath('alpha')).toBe('/workspaces/alpha/projects');
    expect(workspaceProjectsPath(null)).toBe('/workspaces');
    expect(workspaceMembersPath('alpha')).toBe('/workspaces/alpha/members');
    expect(workspaceMembersPath(null)).toBe('/workspaces');
    expect(workspaceActivityPath('alpha')).toBe('/activity/alpha');
    expect(workspaceActivityPath(null)).toBe('/activity');
  });

  it('keeps the current section when the workspace changes', () => {
    expect(workspaceSectionPath('/workspaces/alpha', 'beta')).toBe('/workspaces');
    expect(workspaceSectionPath('/workspaces/alpha/projects', 'beta')).toBe('/workspaces/beta/projects');
    expect(workspaceSectionPath('/workspaces/alpha/projects/launch', 'beta')).toBe('/workspaces/beta/projects');
    expect(workspaceSectionPath('/workspaces/alpha/members', 'beta')).toBe('/workspaces/beta/members');
    expect(workspaceSectionPath('/activity/alpha/launch', 'beta')).toBe('/activity/beta');
    expect(workspaceSectionPath('/workspaces', 'beta')).toBe('/workspaces');
  });
});