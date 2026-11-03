import { describe, expect, it } from 'vitest';

import {
  deriveMobileNetworkState,
  getMobileNetworkState,
  setMobileNetworkState,
  subscribeToMobileNetworkState,
} from './network-state';

describe('mobile network state', () => {
  it('treats an explicitly unavailable connection as offline', () => {
    expect(
      deriveMobileNetworkState({
        isConnected: true,
        isInternetReachable: false,
      }).isOnline,
    ).toBe(false);
    expect(
      deriveMobileNetworkState({
        isConnected: false,
        isInternetReachable: null,
      }).isOnline,
    ).toBe(false);
  });

  it('allows requests while reachability is still unknown', () => {
    expect(
      deriveMobileNetworkState({
        isConnected: null,
        isInternetReachable: null,
      }).isOnline,
    ).toBe(true);
  });

  it('publishes connectivity changes once', () => {
    const received: boolean[] = [];
    const unsubscribe = subscribeToMobileNetworkState((state) =>
      received.push(state.isOnline),
    );
    const offline = {
      isConnected: false,
      isInternetReachable: false,
      isOnline: false,
    };
    setMobileNetworkState(offline);
    setMobileNetworkState(offline);
    unsubscribe();

    expect(getMobileNetworkState()).toEqual(offline);
    expect(received).toEqual([false]);
    setMobileNetworkState({
      isConnected: true,
      isInternetReachable: true,
      isOnline: true,
    });
  });
});
