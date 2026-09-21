import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ApolloProvider } from '@apollo/client/react';

import { App } from './App';
import { AuthProvider } from './features/auth/AuthProvider';
import { clearLegacySupabaseAuthStorage } from './features/auth/legacy-storage';
import { apolloClient } from './lib/apollo-client';
import './styles.css';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('Root element was not found');
}

clearLegacySupabaseAuthStorage();

createRoot(rootElement).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>,
);
