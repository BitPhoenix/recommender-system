---
date: 2025-12-30T09:45:00-08:00
researcher: Claude
git_commit: b9266908ad9d016f0e5d99806554beda57879ae6
branch: tilt-setup
repository: coding-platform
topic: "React Starter Project Setup for recommender_system/client"
tags: [research, react, vite, rtk-query, typescript, tailwindcss, tiltfile]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
last_updated_note: "Added comprehensive RTK Query patterns, directory structure analysis, and ESLint/Prettier configuration details"
---

# Research: React Starter Project Setup

**Date**: 2025-12-30T09:45:00-08:00
**Researcher**: Claude
**Git Commit**: b9266908ad9d016f0e5d99806554beda57879ae6
**Branch**: tilt-setup
**Repository**: coding-platform

## Research Question

Analyze coding_platform/client to create a blank starter React project under recommender_system/client with the same setup: App.tsx, RTK Query, Vite, and TypeScript.

## Summary

The coding_platform/client uses a modern React stack with:
- **Vite 6.2.1** for build tooling
- **React 18.2** with TypeScript 4.9
- **Redux Toolkit 1.9.1** with RTK Query for state management and API calls
- **Tailwind CSS v4** with PostCSS
- **React Router v7** for routing

## Detailed Findings

### Core Dependencies (Essential for Starter)

```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^1.9.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-redux": "^8.0.5",
    "react-router": "^7.8.1",
    "tailwindcss": "^4.0.14",
    "@tailwindcss/postcss": "^4.0.14",
    "postcss": "^8.5.3",
    "typescript": "^4.9.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "4.3.4",
    "vite": "^6.2.1",
    "@typescript-eslint/eslint-plugin": "^8.40.0",
    "@typescript-eslint/parser": "^8.40.0",
    "eslint": "^9.17.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    "prettier": "^3.4.2",
    "typescript-eslint": "^8.40.0",
    "globals": "^15.14.0"
  }
}
```

### File Structure for Starter Project

```
recommender_system/client/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.mjs
├── postcss.config.mjs
├── tailwind.config.js
├── eslint.config.js
├── .prettierrc.json
├── .gitignore
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── store/
    │   ├── index.ts
    │   └── slices/
    │       └── apiSlice.ts
    └── hooks/
        ├── useAppSelector.ts
        └── useAppDispatch.ts
```

### Configuration Files

#### package.json
```json
{
  "name": "recommender-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "serve": "vite preview",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write ."
  }
}
```

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

#### vite.config.mjs
```javascript
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: env.VITE_DEV_HOST || "localhost",
      port: 3002, // Different port from coding-platform
    },
  };
});
```

#### postcss.config.mjs
```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

#### tailwind.config.js
```javascript
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### RTK Query Setup Pattern

#### store/index.ts
```typescript
import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { apiSlice } from "./slices/apiSlice";

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

#### store/slices/apiSlice.ts
```typescript
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || "",
  }),
  tagTypes: [], // Add your tag types here
  endpoints: () => ({}), // Define endpoints in individual feature slices
});
```

#### hooks/useAppSelector.ts
```typescript
import { TypedUseSelectorHook, useSelector } from "react-redux";
import type { RootState } from "../store";

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

#### hooks/useAppDispatch.ts
```typescript
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";

export const useAppDispatch = () => useDispatch<AppDispatch>();
```

### Entry Point Files

#### index.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico?" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recommender System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### src/main.tsx
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { store } from "./store";
import { Provider } from "react-redux";
import { BrowserRouter as Router } from "react-router";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <Router>
        <App />
      </Router>
    </Provider>
  </React.StrictMode>
);
```

#### src/App.tsx
```typescript
import React from "react";
import { Routes, Route } from "react-router";

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/" element={<div className="p-4">Hello Recommender System</div>} />
      </Routes>
    </div>
  );
};

export default App;
```

#### src/index.css
```css
@import "tailwindcss";

html,
body,
#root {
  min-height: 100%;
}
```

#### src/vite-env.d.ts
```typescript
/// <reference types="vite/client" />
```

### ESLint Configuration (eslint.config.js)

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/", "build/", "node_modules/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
        module: "readonly",
        require: "readonly",
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ...reactPlugin.configs.flat.recommended,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "react-hooks": hooksPlugin,
    },
    rules: {
      ...hooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  prettierConfig
);
```

### Prettier Configuration (.prettierrc.json)

```json
{
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "quoteProps": "as-needed",
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always"
}
```

### .gitignore

```
logs
*.log
npm-debug.log*
node_modules
dist
dist-ssr
*.local
.env
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

## Code References

- `client/package.json` - Dependencies and scripts configuration
- `client/vite.config.mjs` - Vite configuration with React plugin
- `client/tsconfig.json` - TypeScript strict mode configuration
- `client/src/store/index.ts` - Redux store with RTK Query setup
- `client/src/store/slices/apiSlice.ts` - Base RTK Query API slice
- `client/src/main.tsx` - Application entry point with Provider setup
- `client/src/App.tsx` - Root component with React Router

## Architecture Insights

1. **RTK Query Pattern**: Uses a base `apiSlice` with empty endpoints, allowing feature-specific API files to inject endpoints using `apiSlice.injectEndpoints()`.

2. **TypeScript Hooks**: Custom `useAppSelector` and `useAppDispatch` hooks provide type safety throughout the application.

3. **Tailwind v4**: Uses the new `@import "tailwindcss"` syntax and `@tailwindcss/postcss` plugin.

4. **Module System**: Uses ES modules (`"type": "module"`) with `.mjs` config files.

## Target Directory

The starter project should be created at:
```
/Users/konrad/Documents/coding/software_devs/recommender_system/client/
```

Note: The directory is `recommender_system` (singular), not `recommender_systems` (plural).

## Tiltfile Configuration

### coding-platform Client Configuration (Reference)

The coding-platform uses a `local_resource` to run the Vite dev server:

```python
# From coding-platform/Tiltfile (lines 800-816)
local_resource(
    'client',
    serve_cmd='cd client && npm run dev',
    labels=['client'],
    deps=[
        'client/src',
        'client/public',
        'client/index.html',
        'client/vite.config.mjs',
        'client/package.json',
    ],
    resource_deps=['assessments-api', 'workspaces-api', 'socket-service'],
)
```

**Key points:**
- Uses `serve_cmd` (not `cmd`) for long-running processes
- `deps` trigger rebuilds when files change (though Vite handles HMR internally)
- `resource_deps` ensures APIs are running before the client starts
- `labels` groups the resource in Tilt UI

### recommender_system Tiltfile Addition

Add this to the existing `recommender_system/Tiltfile`:

```python
# ============================================
# Client (React Frontend)
# ============================================

local_resource(
    'client',
    serve_cmd='cd client && npm run dev',
    labels=['recommender'],
    deps=[
        'client/src',
        'client/public',
        'client/index.html',
        'client/vite.config.mjs',
        'client/package.json',
    ],
    resource_deps=['recommender-api'],
)
```

**Differences from coding-platform:**
- Uses `labels=['recommender']` to match existing resources
- Only depends on `recommender-api` (the single backend)
- Port 3002 (configured in vite.config.mjs) to avoid conflict with coding-platform's port 3001

### Environment Variables

Create a `.env` file for local development:

```bash
# client/.env
VITE_API_URL=http://localhost:4025
```

This points to the `recommender-api` which is port-forwarded to 4025 in the Tiltfile.

## Code References

- `coding-platform/Tiltfile:800-816` - Client local_resource configuration
- `recommender_system/Tiltfile` - Current Tiltfile (needs client addition)

## Advanced RTK Query Patterns (From Existing Client)

### Multiple API Slices Pattern

The coding-platform client uses multiple independent RTK Query APIs:

```typescript
// store/index.ts - Multiple APIs in one store
export const store = configureStore({
  reducer: {
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
    [assessmentsApi.reducerPath]: assessmentsApi.reducer,
    [sessionsPlaybackApi.reducerPath]: sessionsPlaybackApi.reducer,
    [logHistoryApi.reducerPath]: logHistoryApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      apiSlice.middleware,
      assessmentsApi.middleware,
      sessionsPlaybackApi.middleware,
      logHistoryApi.middleware
    ),
});
```

### Injecting Endpoints Pattern

Feature-specific APIs extend the base slice:

```typescript
// api/workspaceApi.ts
export const workspaceApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWorkspace: builder.query<Workspace, string>({
      query: (id) => `/workspaces/${id}`,
      providesTags: (result, error, id) => [{ type: "Workspaces", id }],
    }),
    createWorkspace: builder.mutation<Workspace, CreateWorkspaceInput>({
      query: (body) => ({
        url: "/workspaces",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Workspaces"],
    }),
  }),
});

export const { useGetWorkspaceQuery, useCreateWorkspaceMutation } = workspaceApi;
```

### Auth Header Injection

```typescript
// store/slices/apiSlice.ts
baseQuery: fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth?.token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
}),
```

### Cache Configuration Options

```typescript
// For APIs that should NOT cache (like session playback)
export const sessionsPlaybackApi = createApi({
  reducerPath: "sessionsPlaybackApi",
  baseQuery: fetchBaseQuery({ baseUrl: VITE_SESSION_EVENTS_SERVER_URL }),
  keepUnusedDataFor: 0,  // No cache retention
  refetchOnMountOrArgChange: false,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  endpoints: () => ({}),
});
```

## Existing Client Directory Structure (Reference)

The coding-platform client has this comprehensive structure:

```
src/
├── api/               # RTK Query API slices (9 files)
├── components/        # UI components organized by feature (213 files)
│   ├── Admin/
│   ├── Auth/
│   ├── Editor/
│   ├── FileExplorer/
│   ├── Layout/
│   └── UI/            # Reusable UI components
├── contexts/          # React Context providers (86 files)
├── hooks/             # Custom hooks by domain (76 files)
│   ├── goToDefinition/
│   ├── logStream/
│   ├── recording/
│   └── sessionPlayback/
├── pages/             # Route-level components (8 files)
├── store/             # Redux store
│   ├── index.ts
│   └── slices/
├── types/             # TypeScript definitions (28 files)
├── utils/             # Utility functions (49 files)
├── services/          # Business logic (9 files)
├── core/              # Low-level infrastructure
├── mocks/             # MSW mock handlers
├── constants/
├── enums/
└── styles/
```

### Pattern: Feature-Based + Layered Hybrid

- **Feature modules** in `components/` (self-contained with sub-components)
- **Domain hooks** grouped by concern (`recording/`, `sessionPlayback/`)
- **Contexts** for complex UI state (41+ contexts)
- **Services** for business logic (IndexedDB, etc.)

## Environment Variables Pattern

Create `.env` files for different environments:

```bash
# .env (development)
VITE_API_URL=http://localhost:4025

# .env.production
VITE_API_URL=https://api.yourapp.com

# .env.test
VITE_API_URL=http://localhost:5173
VITE_USE_MSW=true
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Open Questions

- Should authentication (authSlice) be included in the starter?
- What API base URL will be used? (Currently using `VITE_API_URL` env var pointing to port 4025)
- Should MSW (Mock Service Worker) be included for development mocking?
- Will it need multiple API slices like the existing client, or just one base slice?
