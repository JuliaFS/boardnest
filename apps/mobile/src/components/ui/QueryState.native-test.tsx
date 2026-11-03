import { fireEvent, render } from '@testing-library/react-native';

import { EmptyState, ErrorState, LoadingState } from './QueryState';

describe('query states', () => {
  test('renders an accessible loading state', async () => {
    const screen = await render(<LoadingState title="Loading projects" />);

    expect(
      screen.getByRole('header', { name: 'Loading projects' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Loading projects')).toBeTruthy();
  });

  test('exposes retry and empty-state actions', async () => {
    const retry = jest.fn();
    const create = jest.fn();
    const error = await render(
      <ErrorState
        actionLabel="Try again"
        description="The request failed."
        onAction={retry}
        title="Projects could not be loaded"
      />,
    );
    await fireEvent.press(error.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);

    const empty = await render(
      <EmptyState
        actionLabel="Create project"
        description="No projects are available."
        onAction={create}
        title="No projects yet"
      />,
    );
    await fireEvent.press(
      empty.getByRole('button', { name: 'Create project' }),
    );
    expect(create).toHaveBeenCalledTimes(1);
  });
});
