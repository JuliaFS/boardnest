import type { WorkspaceRole } from '@boardnest/graphql-types';

const bulgarianTransliteration: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: 'y',
  ю: 'yu',
  я: 'ya',
};

export type WorkspaceFormErrors = {
  name?: string;
  slug?: string;
};

export function workspaceSlugFromName(name: string): string {
  return [...name.toLocaleLowerCase('bg-BG')]
    .map((character) => bulgarianTransliteration[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

export function validateWorkspaceForm(
  name: string,
  slug: string,
): WorkspaceFormErrors {
  const errors: WorkspaceFormErrors = {};
  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();

  if (!trimmedName) errors.name = 'Workspace name is required.';
  else if (trimmedName.length > 100)
    errors.name = 'Workspace name must not exceed 100 characters.';

  if (trimmedSlug.length < 3)
    errors.slug = 'Slug must have at least 3 characters.';
  else if (trimmedSlug.length > 63)
    errors.slug = 'Slug must not exceed 63 characters.';
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug))
    errors.slug = 'Use lowercase letters, numbers, and single hyphens.';

  return errors;
}

export function canManageWorkspace(role: WorkspaceRole | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function workspaceRoleDescription(role: WorkspaceRole): string {
  const descriptions: Record<WorkspaceRole, string> = {
    ADMIN: 'Can manage the workspace, members, and projects.',
    MEMBER: 'Can create and update workspace projects and tasks.',
    OWNER: 'Has full workspace control, including ownership decisions.',
    VIEWER: 'Can view workspace content without changing it.',
  };
  return descriptions[role];
}
