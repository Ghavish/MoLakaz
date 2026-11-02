import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { refresh } from './session';
import { tell } from './theme';

// pulls the latest household whenever the screen comes into view, plus pull-to-refresh
export function useRefresher() {
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, []),
  );

  async function reload() {
    setRefreshing(true);
    try {
      await refresh();
    } catch (e) {
      tell("Couldn't refresh", (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  return { refreshing, reload };
}
