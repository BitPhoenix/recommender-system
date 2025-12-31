# React Starter Project Setup - Implementation Plan

## Overview

Create a minimal React starter project at `recommender_system/client/` with the same foundational setup as `coding-platform/client`: Vite, React 18, TypeScript, RTK Query, Tailwind CSS v4, and React Router v7. This will be a clean starting point for the recommender system frontend.

## Current State Analysis

- **recommender_system/** already exists with:
  - `recommender_api/` - Express backend running on port 4025
  - `Tiltfile` - Kubernetes orchestration with Neo4j and API
  - No client directory exists yet

- **Reference implementation**: `coding-platform/client/` provides the exact patterns and configurations to replicate

## Desired End State

A working React development environment at `recommender_system/client/` with:
- Vite dev server running on port 3002
- RTK Query configured for API calls to `localhost:4025`
- Tailwind CSS v4 with PostCSS
- ESLint + Prettier configured
- Integration with existing Tiltfile

### Verification Criteria
- `npm run dev` starts Vite on port 3002
- `npm run build` compiles successfully
- `npm run lint` passes
- Browser shows "Recommender System" with semantic styling at `localhost:3002`
- Tilt dashboard shows client resource running

## What We're NOT Doing

- No authentication/auth slice (will be added later if needed)
- No MSW mocking setup (can be added later)
- No tests or Playwright (will be added later)
- No complex components or pages
- No additional API slices beyond the base `apiSlice`

## Implementation Approach

Create all files in a single phase since they're all interdependent. The project structure follows the research document exactly.

---

## Phase 1: Create React Starter Project

### Overview
Create all configuration files and minimal source files to establish the project foundation.

### Changes Required:

#### 1. package.json
**File**: `recommender_system/client/package.json`

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
  },
  "dependencies": {
    "@reduxjs/toolkit": "^1.9.1",
    "@tailwindcss/postcss": "^4.0.14",
    "@tailwindcss/typography": "^0.5.16",
    "postcss": "^8.5.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-redux": "^8.0.5",
    "react-router": "^7.8.1",
    "tailwindcss": "^4.0.14",
    "typescript": "^4.9.4"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^8.40.0",
    "@typescript-eslint/parser": "^8.40.0",
    "@vitejs/plugin-react": "4.3.4",
    "eslint": "^9.17.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    "globals": "^15.14.0",
    "prettier": "^3.4.2",
    "typescript-eslint": "^8.40.0",
    "vite": "^6.2.1"
  }
}
```

#### 2. TypeScript Configuration
**File**: `recommender_system/client/tsconfig.json`

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

#### 3. Vite Configuration
**File**: `recommender_system/client/vite.config.mjs`

```javascript
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: env.VITE_DEV_HOST || "localhost",
      port: 3002,
    },
  };
});
```

#### 4. PostCSS Configuration
**File**: `recommender_system/client/postcss.config.mjs`

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

#### 5. Tailwind Configuration
**File**: `recommender_system/client/tailwind.config.js`

```javascript
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

#### 6. ESLint Configuration
**File**: `recommender_system/client/eslint.config.js`

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

#### 7. Prettier Configuration
**File**: `recommender_system/client/.prettierrc.json`

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

#### 8. Git Ignore
**File**: `recommender_system/client/.gitignore`

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

#### 9. HTML Entry Point
**File**: `recommender_system/client/index.html`

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

#### 10. Main Entry Point
**File**: `recommender_system/client/src/main.tsx`

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

#### 11. App Component
**File**: `recommender_system/client/src/App.tsx`

```typescript
import { Routes, Route } from "react-router";

function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-heading-xl text-content-primary mb-4">
        Recommender System
      </h1>
      <p className="text-body-md text-content-secondary mb-6">
        Welcome to the recommender system client.
      </p>
      <button className="px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-white rounded-md transition-colors">
        Get Started
      </button>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </div>
  );
}

export default App;
```

#### 12. CSS Entry Point with Semantic Styling System
**File**: `recommender_system/client/src/index.css`

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* Tailwind v4 dark mode configuration */
@custom-variant dark (&:where(.dark, .dark *));

/* Ensure the page background matches the theme canvas */
html,
body,
#root {
  min-height: 100%;
  background-color: var(--color-canvas);
}

@theme {
  /* Typography Scale */
  --text-heading-xl: 1.75rem;   /* 28px */
  --text-heading-lg: 1.5rem;    /* 24px */
  --text-heading-md: 1.25rem;   /* 20px */
  --text-heading-sm: 1.125rem;  /* 18px */
  --text-body-lg: 1rem;         /* 16px */
  --text-body-md: 0.875rem;     /* 14px */
  --text-body-sm: 0.75rem;      /* 12px */
  --text-body-xs: 0.6875rem;    /* 11px */

  /* Line heights */
  --leading-heading: 1.2;
  --leading-body: 1.5;
  --leading-relaxed: 1.6;

  /* Semantic background colors */
  --color-canvas: #f9fafb; /* gray-50 */
  --color-surface: white;
  --color-page: white;
  --color-interactive: #f5f5f4; /* stone-100 */

  /* Content colors */
  --color-content-primary: #111827; /* gray-900 */
  --color-content-secondary: #4b5563; /* gray-600 */
  --color-content-tertiary: #6b7280; /* gray-500 */

  /* Border colors */
  --color-border-default: #d1d5db; /* gray-300 */
  --color-border-subtle: #e5e7eb; /* gray-200 */

  /* Action colors */
  --color-action-primary: #1d4ed8; /* blue-700 */
  --color-action-primary-hover: #1e40af; /* blue-800 */

  /* Status colors */
  --color-success: #047857; /* green-700 */
  --color-success-hover: #065f46; /* green-800 */
  --color-warning: #b45309; /* amber-700 */
  --color-warning-hover: #92400e; /* amber-800 */
  --color-error: #dc2626; /* red-600 */
  --color-error-hover: #b91c1c; /* red-700 */

  /* Focus states */
  --color-focus-ring: #3b82f6; /* blue-500 */
  --color-focus-offset: white;

  /* Interactive states */
  --color-hover-surface: #f9fafb; /* gray-50 */
  --color-selected-surface: #e5e7eb; /* gray-200 */
}

.dark {
  --color-canvas: #1e1e1e; /* VSCode editor dark */
  --color-surface: #252526; /* VSCode sidebar dark */
  --color-page: #1e1e1e;
  --color-interactive: #2d2d30;

  /* Content colors */
  --color-content-primary: #cccccc;
  --color-content-secondary: #d1d1d1;
  --color-content-tertiary: #a1a1aa;

  /* Border colors */
  --color-border-default: #3a4146;
  --color-border-subtle: #2d3135;

  /* Action colors */
  --color-action-primary: #396dd5;
  --color-action-primary-hover: #1d4ed8;

  /* Status colors */
  --color-success: #10b981;
  --color-success-hover: #34d399;
  --color-warning: #f59e0b;
  --color-warning-hover: #d97706;
  --color-error: #f87171;
  --color-error-hover: #fca5a5;

  /* Focus states */
  --color-focus-ring: #60a5fa;
  --color-focus-offset: #1e1e1e;

  /* Interactive states */
  --color-hover-surface: #2d2d30;
  --color-selected-surface: #3c3c3c;
}

/* Typography utility classes */
.text-heading-xl { font-size: var(--text-heading-xl); font-weight: 700; line-height: var(--leading-heading); }
.text-heading-lg { font-size: var(--text-heading-lg); font-weight: 600; line-height: var(--leading-heading); }
.text-heading-md { font-size: var(--text-heading-md); font-weight: 600; line-height: var(--leading-heading); }
.text-heading-sm { font-size: var(--text-heading-sm); font-weight: 500; line-height: var(--leading-heading); }
.text-body-lg { font-size: var(--text-body-lg); line-height: var(--leading-body); }
.text-body-md { font-size: var(--text-body-md); line-height: var(--leading-body); }
.text-body-sm { font-size: var(--text-body-sm); line-height: var(--leading-body); }
.text-body-xs { font-size: var(--text-body-xs); line-height: var(--leading-body); }
```

#### 13. Vite Environment Types
**File**: `recommender_system/client/src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />
```

#### 14. Redux Store
**File**: `recommender_system/client/src/store/index.ts`

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

#### 15. API Slice
**File**: `recommender_system/client/src/store/slices/apiSlice.ts`

```typescript
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || "",
  }),
  tagTypes: [],
  endpoints: () => ({}),
});
```

#### 16. Typed Selector Hook
**File**: `recommender_system/client/src/hooks/useAppSelector.ts`

```typescript
import { TypedUseSelectorHook, useSelector } from "react-redux";
import type { RootState } from "../store";

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

#### 17. Typed Dispatch Hook
**File**: `recommender_system/client/src/hooks/useAppDispatch.ts`

```typescript
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";

export const useAppDispatch = () => useDispatch<AppDispatch>();
```

#### 18. Environment File
**File**: `recommender_system/client/.env`

```bash
VITE_API_URL=http://localhost:4025
```

### Success Criteria:

#### Automated Verification:
- [x] All files created in correct locations
- [x] `cd recommender_system/client && npm install` completes without errors
- [x] `npm run build` compiles successfully with no TypeScript errors
- [x] `npm run lint` passes with no errors

#### Manual Verification:
- [x] `npm run dev` starts Vite server on port 3002
- [x] Browser at `http://localhost:3002` shows "Recommender System" heading
- [x] Page has light gray background (`bg-canvas` = #f9fafb)
- [x] Heading uses semantic typography (large, bold, dark text)
- [x] Button is blue and changes shade on hover

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the dev server runs and displays correctly before proceeding to Phase 2.

---

## Phase 2: Update Tiltfile

### Overview
Add the client local_resource to the existing Tiltfile so it starts with `tilt up`.

### Changes Required:

**File**: `recommender_system/Tiltfile`
**Changes**: Add client local_resource at the end of the file

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
        'client/index.html',
        'client/vite.config.mjs',
        'client/package.json',
    ],
    resource_deps=['recommender-api'],
)
```

### Success Criteria:

#### Automated Verification:
- [x] Tiltfile syntax is valid (no Python errors)

#### Manual Verification:
- [x] `tilt up` in recommender_system directory shows client resource
- [x] Client waits for recommender-api before starting
- [x] Clicking "Open" in Tilt UI opens the app at port 3002

**Implementation Note**: After completing this phase, verify in Tilt dashboard that all resources start correctly.

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to `recommender_system/client`
2. Run `npm install`
3. Run `npm run dev` - should start on port 3002
4. Open browser to `http://localhost:3002`
5. Verify page displays with:
   - Light gray background (semantic `bg-canvas`)
   - "Recommender System" heading with large, bold typography
   - Blue "Get Started" button that darkens on hover
6. Run `npm run build` - should complete without errors
7. Run `npm run lint` - should pass
8. Stop dev server, run `tilt up` from `recommender_system/`
9. Verify client appears in Tilt dashboard and starts after API

---

## File Structure Summary

```
recommender_system/client/
├── .env
├── .gitignore
├── .prettierrc.json
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.mjs
├── tailwind.config.js
├── tsconfig.json
├── vite.config.mjs
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── vite-env.d.ts
    ├── hooks/
    │   ├── useAppDispatch.ts
    │   └── useAppSelector.ts
    └── store/
        ├── index.ts
        └── slices/
            └── apiSlice.ts
```

---

## References

- Research document: `thoughts/shared/research/2025-12-30-react-starter-project-setup.md`
- Reference implementation: `coding-platform/client/`
- Existing Tiltfile: `recommender_system/Tiltfile`
