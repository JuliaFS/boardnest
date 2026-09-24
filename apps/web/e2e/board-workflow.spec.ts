import { expect, test, type Route } from '@playwright/test';

const user = {
  displayName: 'Test User',
  email: 'person@example.com',
  id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
  role: 'authenticated',
};
const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';
const projectId = 'f2410cb7-47f6-4af6-8ed9-f1d7a45158fc';
const taskId = 'ae248328-e9e4-4416-a92d-47af95406e4d';
const todoId = '6954de6d-ed8e-4409-8be8-9e0ce72ba8c4';
const doneId = '67b31b8b-abbb-4134-b2d8-32984172c3ed';
const timestamp = new Date(0).toISOString();

const corsHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:4173',
};

test('an anonymous visitor can sign in and reach the protected projects page', async ({
  page,
}) => {
  let authenticated = false;
  await page.route('http://127.0.0.1:4000/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return allowCors(route);
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/session') {
      return json(
        route,
        authenticated ? { user } : { error: 'Unauthorized' },
        authenticated ? 200 : 401,
      );
    }
    if (path === '/auth/login') {
      authenticated = true;
      return json(route, { user });
    }
    if (path === '/graphql') {
      return json(route, connection('workspaces', []));
    }
    return json(route, { error: 'Unexpected request' }, 404);
  });

  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill('StrongPass1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
});

test('creates a workspace, project and task, then edits and moves the task', async ({
  page,
}) => {
  let workspace: Record<string, unknown> | null = null;
  let project: Record<string, unknown> | null = null;
  let task: Record<string, unknown> | null = null;
  let moveInput: Record<string, unknown> | null = null;

  await page.routeWebSocket('ws://127.0.0.1:4000/graphql', (socket) => {
    socket.onMessage((message) => {
      const value = JSON.parse(String(message)) as { type?: string };
      if (value.type === 'connection_init') {
        socket.send(JSON.stringify({ type: 'connection_ack' }));
      }
    });
  });
  await page.route('http://127.0.0.1:4000/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return allowCors(route);
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/session') return json(route, { user });
    if (path !== '/graphql') {
      return json(route, { error: 'Unexpected request' }, 404);
    }

    const request = route.request().postDataJSON() as {
      operationName?: string;
      variables?: Record<string, unknown>;
    };
    const variables = request.variables ?? {};

    switch (request.operationName) {
      case 'Workspaces':
        return json(
          route,
          connection('workspaces', workspace ? [workspace] : []),
        );
      case 'CreateWorkspace':
        workspace = {
          __typename: 'Workspace',
          id: workspaceId,
          name: 'Product Team',
          slug: 'product-team',
          updatedAt: timestamp,
        };
        return json(route, { data: { createWorkspace: workspace } });
      case 'Projects':
        return json(route, connection('projects', project ? [project] : []));
      case 'CreateProject':
        project = {
          __typename: 'Project',
          description: 'Release planning',
          dueDate: null,
          id: projectId,
          name: 'Launch',
          startDate: null,
          status: 'ACTIVE',
          updatedAt: timestamp,
          visibility: 'PRIVATE',
          workspaceId,
        };
        return json(route, { data: { createProject: project } });
      case 'Project':
        return json(route, { data: { project } });
      case 'Board':
        return json(route, {
          data: {
            taskStatuses: [
              status(todoId, 'To do', 'todo', 1000),
              status(doneId, 'Done', 'done', 2000),
            ],
            tasks: {
              __typename: 'TaskConnection',
              nodes: task ? [task] : [],
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                limit: 100,
                offset: 0,
              },
            },
          },
        });
      case 'CreateTask':
        task = {
          __typename: 'Task',
          description: 'Release checklist',
          dueAt: null,
          id: taskId,
          position: 1000,
          priority: 'HIGH',
          projectId,
          statusId: todoId,
          title: 'Prepare release',
          updatedAt: timestamp,
        };
        return json(route, { data: { createTask: task } });
      case 'Task':
        return json(route, { data: { task } });
      case 'UpdateTask': {
        const input = variables.input as Record<string, unknown>;
        task = { ...task, ...input, updatedAt: timestamp };
        return json(route, { data: { updateTask: task } });
      }
      case 'MoveTask': {
        moveInput = variables.input as Record<string, unknown>;
        task = { ...task, ...moveInput, updatedAt: timestamp };
        return json(route, { data: { moveTask: task } });
      }
      default:
        return json(route, {
          errors: [
            { message: `Unhandled operation: ${request.operationName}` },
          ],
        });
    }
  });

  await page.goto('/projects');
  await page
    .getByRole('heading', { name: 'No workspaces available' })
    .locator('..')
    .getByRole('button', { name: 'Create workspace' })
    .last()
    .click();
  const workspaceDialog = page.getByRole('dialog', {
    name: 'Create workspace',
  });
  await workspaceDialog.getByLabel('Workspace name').fill('Product Team');
  await expect(workspaceDialog.getByPlaceholder('product-team')).toHaveValue(
    'product-team',
  );
  await workspaceDialog
    .getByRole('button', { name: 'Create workspace' })
    .click();

  await expect(page.getByRole('combobox', { name: 'Workspace' })).toHaveValue(
    workspaceId,
  );
  await page
    .getByRole('heading', { name: 'No projects here yet' })
    .locator('..')
    .getByRole('button', { name: 'Create project' })
    .last()
    .click();
  const projectDialog = page.getByRole('dialog', { name: 'Create project' });
  await projectDialog.getByLabel('Project name').fill('Launch');
  await projectDialog.getByLabel('Description').fill('Release planning');
  await projectDialog.getByLabel('Visibility').selectOption('PRIVATE');
  await projectDialog.getByRole('button', { name: 'Create project' }).click();

  await expect(page.getByRole('link', { name: 'Launch' })).toBeVisible();
  await page.getByRole('link', { name: /Open board/ }).click();
  await page.getByRole('button', { name: 'Add task to To do' }).click();
  const taskDialog = page.getByRole('dialog', { name: 'Create task' });
  await taskDialog.getByLabel('Task title').fill('Prepare release');
  await taskDialog.getByLabel('Description').fill('Release checklist');
  await taskDialog.getByLabel('Priority').selectOption('HIGH');
  await taskDialog.getByRole('button', { name: 'Create task' }).click();

  await expect(
    page.getByRole('link', { name: 'Prepare release' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Prepare release' }).click();
  await page.getByRole('button', { name: 'Edit task' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit task' });
  await editDialog.getByLabel('Task title').fill('Prepare production release');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Prepare production release' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Back to board' }).click();
  const card = page
    .locator('article')
    .filter({ hasText: 'Prepare production release' });
  const doneColumn = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Done' }),
  });
  const sourceBox = await card.boundingBox();
  const targetBox = await doneColumn.boundingBox();
  if (!sourceBox || !targetBox)
    throw new Error('Kanban drag target is missing');
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 15, sourceBox.y, {
    steps: 3,
  });
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + Math.min(160, targetBox.height / 2),
    { steps: 12 },
  );
  await page.mouse.up();

  await expect.poll(() => moveInput?.statusId ?? null).toBe(doneId);
});

function status(id: string, name: string, category: string, position: number) {
  return {
    __typename: 'TaskStatus',
    category,
    color: category === 'done' ? '#22c55e' : '#64748b',
    id,
    name,
    position,
    projectId,
  };
}

function connection(field: string, nodes: Array<Record<string, unknown>>) {
  return {
    data: {
      [field]: {
        __typename:
          field === 'workspaces' ? 'WorkspaceConnection' : 'ProjectConnection',
        nodes,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          limit: 25,
          offset: 0,
        },
      },
    },
  };
}

async function allowCors(route: Route) {
  await route.fulfill({ headers: corsHeaders, status: 204 });
}

async function json(route: Route, body: unknown, statusCode = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: corsHeaders,
    status: statusCode,
  });
}
