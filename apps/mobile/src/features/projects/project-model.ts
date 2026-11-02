import type {
  ProjectRole,
  ProjectStatus,
  ProjectVisibility,
  WorkspaceRole,
} from '@boardnest/graphql-types';

export type ProjectFormErrors = {
  dueDate?: string;
  name?: string;
  startDate?: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function validateProjectForm(
  name: string,
  startDate: string,
  dueDate: string,
): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  if (!name.trim()) errors.name = 'Project name is required.';
  else if (name.trim().length > 120)
    errors.name = 'Project name cannot exceed 120 characters.';
  if (startDate && !datePattern.test(startDate))
    errors.startDate = 'Use YYYY-MM-DD.';
  if (dueDate && !datePattern.test(dueDate)) errors.dueDate = 'Use YYYY-MM-DD.';
  if (!errors.startDate && !errors.dueDate && startDate && dueDate) {
    if (dueDate < startDate)
      errors.dueDate = 'Due date cannot be before the start date.';
  }
  return errors;
}

export function canManageProject(
  workspaceRole: WorkspaceRole | undefined,
  projectRole: ProjectRole | undefined,
): boolean {
  return (
    workspaceRole === 'OWNER' ||
    workspaceRole === 'ADMIN' ||
    (workspaceRole === 'MEMBER' && projectRole === 'PROJECT_LEAD')
  );
}

export function projectRoleDescription(role: ProjectRole): string {
  if (role === 'PROJECT_LEAD')
    return 'Can manage project details, members, and project work.';
  if (role === 'MEMBER') return 'Can contribute to project work.';
  return 'Can view the project without editing it.';
}

export function projectStatusLabel(status: ProjectStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

export function projectVisibilityDescription(
  visibility: ProjectVisibility,
): string {
  return visibility === 'PRIVATE'
    ? 'Only assigned project members, workspace owners, and admins can access it.'
    : 'All workspace members can discover this project.';
}

export function actionableProjectError(message: string): string {
  if (message.includes('Guest limit reached: 1 project')) {
    return 'Guest accounts can create one project. Sign in with a registered account to create more.';
  }
  if (message.toLowerCase().includes('quota')) {
    return `${message} Review the current workspace plan or remove an unused project.`;
  }
  return message;
}
