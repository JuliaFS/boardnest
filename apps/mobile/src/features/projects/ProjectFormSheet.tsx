import {
  CreateMobileProjectDocument,
  MobileProjectsDocument,
  UpdateMobileProjectDocument,
  type ProjectStatus,
  type ProjectVisibility,
} from '@boardnest/graphql-types';
import { useMutation } from '@apollo/client/react';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  AppTextField,
  BottomSheetModal,
} from '@/components/ui';
import { theme } from '@/theme';

import {
  actionableProjectError,
  projectStatusLabel,
  projectVisibilityDescription,
  validateProjectForm,
  type ProjectFormErrors,
} from './project-model';

type ProjectValue = {
  description?: string | null;
  dueDate?: string | null;
  id: string;
  name: string;
  startDate?: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  workspaceId: string;
};

type ProjectFormSheetProps = {
  initialProject?: ProjectValue;
  onClose: () => void;
  onCompleted: (project: ProjectValue) => void;
  visible: boolean;
  workspaceId: string;
};

const statuses: ProjectStatus[] = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED'];
const visibilities: ProjectVisibility[] = ['WORKSPACE', 'PRIVATE'];

export function ProjectFormSheet({
  initialProject,
  onClose,
  onCompleted,
  visible,
  workspaceId,
}: ProjectFormSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
  const [visibility, setVisibility] = useState<ProjectVisibility>('WORKSPACE');
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [createProject, createState] = useMutation(
    CreateMobileProjectDocument,
    {
      refetchQueries: [MobileProjectsDocument],
    },
  );
  const [updateProject, updateState] = useMutation(
    UpdateMobileProjectDocument,
    {
      refetchQueries: [MobileProjectsDocument],
    },
  );

  useEffect(() => {
    if (!visible) return;
    setName(initialProject?.name ?? '');
    setDescription(initialProject?.description ?? '');
    setStartDate(initialProject?.startDate ?? '');
    setDueDate(initialProject?.dueDate ?? '');
    setStatus(initialProject?.status ?? 'ACTIVE');
    setVisibility(initialProject?.visibility ?? 'WORKSPACE');
    setErrors({});
  }, [initialProject, visible]);

  const mutationState = initialProject ? updateState : createState;

  async function submit() {
    const nextErrors = validateProjectForm(name, startDate, dueDate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const input = {
      description: description.trim() || null,
      dueDate: dueDate || null,
      name: name.trim(),
      startDate: startDate || null,
      status,
      visibility,
    };

    try {
      if (initialProject) {
        const result = await updateProject({
          variables: { id: initialProject.id, input },
        });
        if (result.data) onCompleted(result.data.updateProject);
      } else {
        const result = await createProject({
          variables: { input: { ...input, workspaceId } },
        });
        if (result.data) onCompleted(result.data.createProject);
      }
    } catch {
      // Apollo exposes the actionable GraphQL error through mutationState.
    }
  }

  return (
    <BottomSheetModal
      description="Choose the project lifecycle, visibility, and optional schedule."
      onClose={onClose}
      title={initialProject ? 'Edit project' : 'Create project'}
      visible={visible}
    >
      <View style={styles.form}>
        <AppTextField
          autoCapitalize="sentences"
          autoFocus
          error={errors.name}
          label="Project name"
          onChangeText={setName}
          value={name}
        />
        <AppTextField
          label="Description"
          multiline
          numberOfLines={3}
          onChangeText={setDescription}
          style={styles.multiline}
          value={description}
        />
        <OptionGroup label="Status">
          {statuses.map((option) => (
            <AppButton
              key={option}
              label={projectStatusLabel(option)}
              onPress={() => setStatus(option)}
              variant={status === option ? 'primary' : 'secondary'}
            />
          ))}
        </OptionGroup>
        <OptionGroup label="Visibility">
          {visibilities.map((option) => (
            <AppButton
              key={option}
              label={option === 'WORKSPACE' ? 'Workspace' : 'Private'}
              onPress={() => setVisibility(option)}
              variant={visibility === option ? 'primary' : 'secondary'}
            />
          ))}
          <Text style={styles.hint}>
            {projectVisibilityDescription(visibility)}
          </Text>
        </OptionGroup>
        <AppTextField
          autoCapitalize="none"
          error={errors.startDate}
          hint="Optional, formatted as YYYY-MM-DD."
          label="Start date"
          onChangeText={setStartDate}
          placeholder="2026-12-01"
          value={startDate}
        />
        <AppTextField
          autoCapitalize="none"
          error={errors.dueDate}
          hint="Optional, formatted as YYYY-MM-DD."
          label="Due date"
          onChangeText={setDueDate}
          placeholder="2026-12-31"
          value={dueDate}
        />
        {mutationState.error ? (
          <AppBanner
            message={actionableProjectError(mutationState.error.message)}
            title="Project could not be saved"
            tone="error"
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton label="Cancel" onPress={onClose} variant="secondary" />
          <AppButton
            label={initialProject ? 'Save changes' : 'Create project'}
            loading={mutationState.loading}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

function OptionGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  form: { gap: theme.spacing.lg },
  hint: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  multiline: { minHeight: 96, paddingTop: theme.spacing.md },
  options: { gap: theme.spacing.sm },
});
