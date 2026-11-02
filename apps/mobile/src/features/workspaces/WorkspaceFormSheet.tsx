import {
  CreateMobileWorkspaceDocument,
  MobileWorkspacesDocument,
  UpdateMobileWorkspaceDocument,
} from '@boardnest/graphql-types';
import { useMutation } from '@apollo/client/react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  AppTextField,
  BottomSheetModal,
} from '@/components/ui';
import { theme } from '@/theme';

import {
  validateWorkspaceForm,
  workspaceSlugFromName,
  type WorkspaceFormErrors,
} from './workspace-model';

type WorkspaceFormSheetProps = {
  initialWorkspace?: { id: string; name: string; slug: string };
  onClose: () => void;
  onCompleted: (workspace: { id: string; name: string; slug: string }) => void;
  visible: boolean;
};

export function WorkspaceFormSheet({
  initialWorkspace,
  onClose,
  onCompleted,
  visible,
}: WorkspaceFormSheetProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [errors, setErrors] = useState<WorkspaceFormErrors>({});
  const slugWasEdited = useRef(false);
  const [createWorkspace, createState] = useMutation(
    CreateMobileWorkspaceDocument,
    { refetchQueries: [MobileWorkspacesDocument] },
  );
  const [updateWorkspace, updateState] = useMutation(
    UpdateMobileWorkspaceDocument,
    {
      refetchQueries: [MobileWorkspacesDocument],
    },
  );

  useEffect(() => {
    if (!visible) return;
    setName(initialWorkspace?.name ?? '');
    setSlug(initialWorkspace?.slug ?? '');
    setErrors({});
    slugWasEdited.current = Boolean(initialWorkspace);
  }, [initialWorkspace, visible]);

  const mutationState = initialWorkspace ? updateState : createState;

  async function submit() {
    const nextErrors = validateWorkspaceForm(name, slug);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const input = { name: name.trim(), slug: slug.trim() };
      if (initialWorkspace) {
        const result = await updateWorkspace({
          variables: { id: initialWorkspace.id, input },
        });
        if (result.data) onCompleted(result.data.updateWorkspace);
      } else {
        const result = await createWorkspace({ variables: { input } });
        if (result.data) onCompleted(result.data.createWorkspace);
      }
    } catch {
      // Apollo exposes the actionable GraphQL error through mutationState.
    }
  }

  return (
    <BottomSheetModal
      description="The slug is unique across Boardnest and becomes part of the workspace URL."
      onClose={onClose}
      title={initialWorkspace ? 'Edit workspace' : 'Create workspace'}
      visible={visible}
    >
      <View style={styles.form}>
        <AppTextField
          autoCapitalize="words"
          autoFocus
          error={errors.name}
          label="Workspace name"
          onChangeText={(value) => {
            setName(value);
            if (!slugWasEdited.current) setSlug(workspaceSlugFromName(value));
          }}
          returnKeyType="next"
          value={name}
        />
        <AppTextField
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.slug}
          hint="Generated from the name. You can add a word or number if it is already used."
          label="URL slug"
          onChangeText={(value) => {
            slugWasEdited.current = true;
            setSlug(value.toLowerCase());
          }}
          placeholder="product-team"
          value={slug}
        />
        {mutationState.error ? (
          <AppBanner
            message={mutationState.error.message}
            title="Workspace could not be saved"
            tone="error"
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton label="Cancel" onPress={onClose} variant="secondary" />
          <AppButton
            label={initialWorkspace ? 'Save changes' : 'Create workspace'}
            loading={mutationState.loading}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  form: { gap: theme.spacing.lg },
});
