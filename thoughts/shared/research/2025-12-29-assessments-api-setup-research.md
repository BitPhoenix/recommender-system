---
date: 2025-12-29T12:00:00-08:00
researcher: Claude
topic: "How assessments_api is set up in coding-platform"
tags: [research, codebase, node, express, helm, tilt, tsx, neo4j-migration]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude
---

# Research: Assessments API Project Setup

**Date**: 2025-12-29
**Researcher**: Claude
**Repository**: coding-platform

## Research Question

How is `assessments_api` set up in `software_devs/coding-platform/assessments_api`? This research will inform creating a new Node/Express project with Helm, tsx, Tiltfile, and Neo4j database.

## Summary

The assessments_api is a TypeScript/Express API using:
- **Node.js 22** with **tsx** for TypeScript execution
- **Express 5.1.0** for the HTTP server
- **Prisma ORM** with PostgreSQL (will adapt for Neo4j)
- **Helm charts** for Kubernetes deployment
- **Tilt** for local development with live reload

Key patterns to replicate:
1. ES modules with tsx for development
2. Simple health check endpoint (`/health`)
3. Helm chart with deployment, service, and values files
4. Tiltfile with docker_build, k8s_yaml, and port forwarding
5. Environment configuration via config.ts

## Detailed Findings

### 1. Project Structure

```
assessments_api/
├── .dockerignore
├── .gitignore
├── .prettierrc.json
├── Dockerfile
├── Dockerfile.dev
├── eslint.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── src/
    ├── config.ts          # Environment configuration
    ├── index.ts           # Main entry point (Express server)
    ├── prisma.ts          # Database client singleton
    ├── controllers/
    ├── routes/
    ├── services/
    ├── middleware/
    ├── types/
    └── utils/
```

### 2. Package.json Configuration

**Key settings:**
```json
{
  "name": "assessments_api",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src/**/*.ts"
  }
}
```

**Key dependencies:**
- `express`: ^5.1.0
- `cors`: ^2.8.5
- `morgan`: ^1.10.0 (HTTP logging)

**Key devDependencies:**
- `typescript`: ^5.8.2
- `tsx`: ^4.21.0
- `eslint`: ^9.33.0
- `prettier`: ^3.6.2

### 3. TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "rootDir": ".",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Express Server Setup (src/index.ts)

**Minimal server pattern:**
```typescript
import express from "express";
import cors from "cors";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(express.json());
app.use(morgan("combined"));
app.use(cors());

// Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Start server
app.listen(PORT, () => {
  console.log(`Assessments API is running on port ${PORT}`);
});
```

**Health check patterns:**
- `/health` - Simple liveness check, returns "OK"
- `/db-health` - Database connectivity check

### 5. Configuration Management (src/config.ts)

```typescript
interface Config {
  PORT: number;
  NODE_ENV: string;
  // Add other config as needed
}

const config: Config = {
  PORT: parseInt(process.env.PORT || "4001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
};

export default config;
```

### 6. Dockerfile.dev

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install necessary packages
RUN apk add --no-cache curl bash openssl3

# Copy package files first for better caching
COPY assessments_api/package*.json ./
COPY assessments_api/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY assessments_api/src ./src

EXPOSE 4001

# Start with tsx watch for hot reload
CMD ["npm", "run", "dev"]
```

### 7. Helm Chart Structure

**Location:** `helm_charts/assessments-api/`

```
assessments-api/
├── Chart.yaml
├── values.yaml
├── values.dev.yaml
└── templates/
    ├── _helpers.tpl
    ├── deployment.yaml
    └── service.yaml
```

**Chart.yaml:**
```yaml
apiVersion: v2
name: assessments-api
description: Helm chart for Assessments API
type: application
version: 0.1.0
appVersion: "1.0"
```

**values.yaml:**
```yaml
replicaCount: 1

image:
  repository: assessments_api
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 4001
  targetPort: 4001

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 200m
    memory: 512Mi

env: {}
```

**values.dev.yaml:**
```yaml
env:
  NODE_ENV: "development"
  PORT: "4001"
  # Neo4j connection (replacing PostgreSQL pattern)
  NEO4J_URI: "bolt://neo4j-db.recommender.svc.cluster.local:7687"
  NEO4J_USER: "neo4j"
  NEO4J_PASSWORD: "password"
```

**templates/deployment.yaml (key sections):**
```yaml
spec:
  containers:
    - name: {{ .Chart.Name }}
      image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
      ports:
        - containerPort: {{ .Values.service.targetPort }}
      env:
        {{- range $key, $value := .Values.env }}
        - name: {{ $key }}
          value: {{ $value | quote }}
        {{- end }}
      startupProbe:
        httpGet:
          path: /health
          port: {{ .Values.service.targetPort }}
        failureThreshold: 30
        periodSeconds: 5
      livenessProbe:
        httpGet:
          path: /health
          port: {{ .Values.service.targetPort }}
        initialDelaySeconds: 30
        periodSeconds: 15
      readinessProbe:
        httpGet:
          path: /health
          port: {{ .Values.service.targetPort }}
        initialDelaySeconds: 10
        periodSeconds: 10
```

### 8. Tiltfile Configuration

**Key patterns from main Tiltfile:**

```python
# Docker build with live update
docker_build(
    'recommender_api',
    context='.',
    dockerfile='recommender_api/Dockerfile.dev',
    only=['recommender_api/'],
    live_update=[
        sync('recommender_api/src', '/app/src'),
        run('npm install', trigger=['recommender_api/package.json']),
    ],
)

# Kubernetes deployment via Helm
k8s_yaml(helm(
    'helm_charts/recommender-api',
    name='recommender-api',
    namespace='recommender',
    values=['helm_charts/recommender-api/values.dev.yaml'],
    set=[
        'image.repository=recommender_api',
        'image.tag=latest',
        'image.pullPolicy=Never',
    ],
))

# Resource configuration with port forwarding
k8s_resource(
    'recommender-api',
    labels=['recommender'],
    port_forwards=['4001:4001'],
    resource_deps=['neo4j-db'],
)
```

### 9. Database Configuration Patterns

**For Neo4j (adapting from PostgreSQL pattern):**

Instead of Prisma, use `neo4j-driver`:

```typescript
// src/neo4j.ts
import neo4j, { Driver } from 'neo4j-driver';

const driver: Driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

export default driver;
```

**Health check for Neo4j:**
```typescript
app.get("/db-health", async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('RETURN 1 as health');
    res.status(200).json({ message: "Neo4j connection successful" });
  } catch (error) {
    res.status(500).json({ message: "Neo4j connection failed", error: error.message });
  } finally {
    await session.close();
  }
});
```

## Code References

| File | Purpose |
|------|---------|
| `assessments_api/src/index.ts` | Express server entry point |
| `assessments_api/src/config.ts` | Environment configuration |
| `assessments_api/package.json` | Dependencies and scripts |
| `assessments_api/tsconfig.json` | TypeScript configuration |
| `assessments_api/Dockerfile.dev` | Development container |
| `helm_charts/assessments-api/Chart.yaml` | Helm chart metadata |
| `helm_charts/assessments-api/values.yaml` | Default Helm values |
| `helm_charts/assessments-api/values.dev.yaml` | Dev environment values |
| `helm_charts/assessments-api/templates/deployment.yaml` | K8s deployment |
| `helm_charts/assessments-api/templates/service.yaml` | K8s service |
| `Tiltfile` | Local development orchestration |

## Architecture Insights

1. **ES Modules**: The project uses `"type": "module"` for native ES module support
2. **tsx for Development**: Uses `tsx watch` for hot-reloading TypeScript without compilation
3. **Helm for Deployment**: Separate values files for different environments (dev vs prod)
4. **Tilt Live Update**: Source files are synced directly to containers for fast iteration
5. **Health Checks**: Three-tier health checks (startup, liveness, readiness) in Kubernetes
6. **Service Discovery**: Uses Kubernetes DNS (`service.namespace.svc.cluster.local`)

## Implementation Recommendations for New Project

### Minimal File Structure
```
recommender_api/
├── Dockerfile.dev
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # Express server + health check
    ├── config.ts       # Environment config
    └── neo4j.ts        # Neo4j driver singleton

helm_charts/recommender-api/
├── Chart.yaml
├── values.yaml
├── values.dev.yaml
└── templates/
    ├── _helpers.tpl
    ├── deployment.yaml
    └── service.yaml

Tiltfile                # At project root
```

### Key Dependencies for New Project
```json
{
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "neo4j-driver": "^5.x"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "tsx": "^4.21.0",
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9"
  }
}
```

## Open Questions

1. Should the Neo4j Helm chart be a separate chart or bundled?
2. What namespace should be used for the recommender service?
3. Are there any additional middleware requirements beyond CORS and logging?
