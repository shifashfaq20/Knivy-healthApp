import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { onCollectionChange } from '../db/events';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Any write to a local collection refreshes every query that reads it.
onCollectionChange((collection) => {
  queryClient.invalidateQueries({ queryKey: ['records', collection] });
});

// Refetch when the app returns to the foreground (step counts, etc.).
AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});
