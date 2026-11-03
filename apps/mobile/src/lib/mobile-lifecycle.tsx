import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBanner } from '@/components/ui';
import {
  mobileApolloClient,
  reconnectMobileRealtime,
  setMobileRealtimeActive,
} from '@/lib/apollo';
import {
  deriveMobileNetworkState,
  getMobileNetworkState,
  setMobileNetworkState,
  subscribeToMobileNetworkState,
  type MobileNetworkState,
} from '@/lib/network-state';
import { mobileSupabase } from '@/lib/supabase';
import { theme } from '@/theme';

type MobileLifecycleContextValue = MobileNetworkState & {
  appState: AppStateStatus;
};

const MobileLifecycleContext =
  createContext<MobileLifecycleContextValue | null>(null);

export function MobileLifecycleProvider({ children }: PropsWithChildren) {
  const initialAppState = normalizeAppState(AppState.currentState);
  const appStateRef = useRef<AppStateStatus>(initialAppState);
  const [appState, setAppState] = useState<AppStateStatus>(initialAppState);
  const [networkState, setNetworkState] = useState(getMobileNetworkState);

  useEffect(
    () =>
      subscribeToMobileNetworkState((nextState) => setNetworkState(nextState)),
    [],
  );

  useEffect(() => {
    let disposed = false;

    function applyNetworkState(rawState: NetInfoState): void {
      if (disposed) return;
      const previous = getMobileNetworkState();
      const next = deriveMobileNetworkState(rawState);
      setMobileNetworkState(next);
      const isActive = appStateRef.current === 'active';
      setMobileRealtimeActive(isActive && next.isOnline);

      if (!previous.isOnline && next.isOnline && isActive) {
        reconnectAndRefresh();
      }
    }

    async function handleAppState(nextState: AppStateStatus): Promise<void> {
      appStateRef.current = nextState;
      setAppState(nextState);
      const isActive = nextState === 'active';

      if (!isActive) {
        setMobileRealtimeActive(false);
        await mobileSupabase.auth.stopAutoRefresh();
        return;
      }

      await mobileSupabase.auth.startAutoRefresh();
      const latestNetworkState = deriveMobileNetworkState(
        await NetInfo.fetch(),
      );
      setMobileNetworkState(latestNetworkState);
      setMobileRealtimeActive(latestNetworkState.isOnline);
      if (latestNetworkState.isOnline) reconnectAndRefresh();
    }

    const removeNetworkListener = NetInfo.addEventListener(applyNetworkState);
    const appStateSubscription = AppState.addEventListener('change', (next) => {
      void handleAppState(next);
    });
    void NetInfo.fetch().then(applyNetworkState);
    void mobileSupabase.auth.startAutoRefresh();

    return () => {
      disposed = true;
      removeNetworkListener();
      appStateSubscription.remove();
      void mobileSupabase.auth.stopAutoRefresh();
      setMobileRealtimeActive(false);
    };
  }, []);

  const value = useMemo(
    () => ({ ...networkState, appState }),
    [appState, networkState],
  );

  return (
    <MobileLifecycleContext value={value}>
      <View style={styles.root}>
        {!networkState.isOnline ? (
          <SafeAreaView edges={['top']} style={styles.bannerArea}>
            <AppBanner
              message="Cached content remains available. Changes are disabled until the connection returns."
              title="You are offline"
              tone="warning"
            />
          </SafeAreaView>
        ) : null}
        <View style={styles.content}>{children}</View>
      </View>
    </MobileLifecycleContext>
  );
}

export function useMobileLifecycle(): MobileLifecycleContextValue {
  const context = useContext(MobileLifecycleContext);
  if (!context) {
    throw new Error(
      'useMobileLifecycle must be used inside MobileLifecycleProvider.',
    );
  }
  return context;
}

function reconnectAndRefresh(): void {
  reconnectMobileRealtime();
  void mobileApolloClient.refetchQueries({ include: 'active' });
}

function normalizeAppState(state: string | null | undefined): AppStateStatus {
  if (
    state === 'active' ||
    state === 'background' ||
    state === 'inactive' ||
    state === 'extension'
  ) {
    return state;
  }
  return 'unknown';
}

const styles = StyleSheet.create({
  bannerArea: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
  },
  content: { flex: 1 },
  root: { flex: 1, backgroundColor: theme.colors.background },
});
