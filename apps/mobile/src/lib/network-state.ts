import type { NetInfoState } from '@react-native-community/netinfo';

export type MobileNetworkState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  isOnline: boolean;
};

const listeners = new Set<(state: MobileNetworkState) => void>();

let currentState: MobileNetworkState = {
  isConnected: null,
  isInternetReachable: null,
  isOnline: true,
};

export function deriveMobileNetworkState(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): MobileNetworkState {
  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
    isOnline:
      state.isConnected !== false && state.isInternetReachable !== false,
  };
}

export function getMobileNetworkState(): MobileNetworkState {
  return currentState;
}

export function setMobileNetworkState(nextState: MobileNetworkState): void {
  if (
    nextState.isConnected === currentState.isConnected &&
    nextState.isInternetReachable === currentState.isInternetReachable &&
    nextState.isOnline === currentState.isOnline
  ) {
    return;
  }

  currentState = nextState;
  for (const listener of listeners) listener(currentState);
}

export function subscribeToMobileNetworkState(
  listener: (state: MobileNetworkState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
