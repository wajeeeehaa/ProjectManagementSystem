'use client';

import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { AuthLoader } from './AuthLoader';
import { store } from './store';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <AuthLoader>{children}</AuthLoader>
    </Provider>
  );
}
