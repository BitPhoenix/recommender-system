# Recommender API Project Setup - Implementation Plan

## Overview

Create a simple Node/Express API project with Neo4j database for the recommender system. The project uses tsx for TypeScript development, Helm charts for Kubernetes deployment, and Tilt for local development orchestration. This follows the patterns established in `coding-platform/assessments_api`.

## Current State Analysis

- Empty project directory at `/Users/konrad/Documents/coding/software_devs/recommender_system/`
- Research document exists at `thoughts/shared/research/2025-12-29-assessments-api-setup-research.md`
- No existing code or configuration

## Desired End State

A fully functional local development environment with:
- Node/Express API running on port 4025
- Neo4j database accessible via Kubernetes
- Hot-reload development via tsx and Tilt live_update
- Health check endpoint at `/health`
- Console log message on server startup

### Verification:
1. `tilt up` starts both neo4j-db and recommender-api
2. `curl http://localhost:4025/health` returns "OK"
3. Code changes in `src/` trigger automatic reload
4. Neo4j is accessible at `bolt://localhost:7687`

## What We're NOT Doing

- Production Dockerfile (only Dockerfile.dev)
- Authentication/authorization middleware
- Actual recommender business logic
- CI/CD pipelines
- Database migrations or seed data
- ESLint/Prettier configuration (can add later)

## Implementation Approach

Follow the assessments_api patterns exactly, adapting for:
- Port 4025 instead of 4001
- Neo4j instead of PostgreSQL
- `recommender` namespace instead of `assessments`

---

## Phase 1: Project Foundation

### Overview
Create the recommender_api directory with package.json, tsconfig.json, and the full directory structure.

### Changes Required:

#### 1. Create Directory Structure
```
recommender_api/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── types/
│   └── utils/
```

#### 2. package.json
**File**: `recommender_api/package.json`

```json
{
  "name": "recommender_api",
  "version": "1.0.0",
  "description": "Recommender System API with Neo4j",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "neo4j-driver": "^5.27.0"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "tsx": "^4.21.0",
    "@types/node": "^22.10.2",
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/morgan": "^1.9.9"
  }
}
```

#### 3. tsconfig.json
**File**: `recommender_api/tsconfig.json`

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

#### 4. .gitignore
**File**: `recommender_api/.gitignore`

```
node_modules/
dist/
.env
*.log
.DS_Store
```

#### 5. .dockerignore
**File**: `recommender_api/.dockerignore`

```
node_modules
dist
Dockerfile
Dockerfile.dev
.git
.gitignore
*.md
```

### Success Criteria:

#### Automated Verification:
- [x] Directory structure exists: `ls -la recommender_api/src/`
- [x] package.json is valid JSON: `cat recommender_api/package.json | jq .`
- [x] tsconfig.json is valid JSON: `cat recommender_api/tsconfig.json | jq .`

#### Manual Verification:
- [ ] Review package.json dependencies are correct
- [ ] Confirm directory structure matches plan

---

## Phase 2: Express Server

### Overview
Implement the Express server with health check endpoint, configuration management, and Neo4j driver singleton.

### Changes Required:

#### 1. Configuration
**File**: `recommender_api/src/config.ts`

```typescript
interface Config {
  PORT: number;
  NODE_ENV: string;
  NEO4J_URI: string;
  NEO4J_USER: string;
  NEO4J_PASSWORD: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || "4025", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  NEO4J_URI: process.env.NEO4J_URI || "bolt://localhost:7687",
  NEO4J_USER: process.env.NEO4J_USER || "neo4j",
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || "password",
};

export default config;
```

#### 2. Neo4j Driver Singleton
**File**: `recommender_api/src/neo4j.ts`

```typescript
import neo4j, { Driver } from "neo4j-driver";
import config from "./config.js";

const driver: Driver = neo4j.driver(
  config.NEO4J_URI,
  neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD)
);

export default driver;
```

#### 3. Express Server Entry Point
**File**: `recommender_api/src/index.ts`

```typescript
import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import config from "./config.js";
import driver from "./neo4j.js";

const app = express();

// Middleware
app.use(express.json());
app.use(morgan("combined"));
app.use(cors());

// Health check - liveness
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

// Database health check
app.get("/db-health", async (_req: Request, res: Response) => {
  const session = driver.session();
  try {
    await session.run("RETURN 1 as health");
    res.status(200).json({ message: "Neo4j connection successful" });
  } catch (error) {
    console.error("Neo4j connection error:", error);
    res.status(500).json({
      message: "Neo4j connection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    await session.close();
  }
});

// Start server
app.listen(config.PORT, () => {
  console.log(`Recommender API is running on port ${config.PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing Neo4j driver...");
  await driver.close();
  process.exit(0);
});
```

#### 4. Placeholder files for future expansion
**File**: `recommender_api/src/controllers/.gitkeep`
**File**: `recommender_api/src/routes/.gitkeep`
**File**: `recommender_api/src/services/.gitkeep`
**File**: `recommender_api/src/middleware/.gitkeep`
**File**: `recommender_api/src/types/.gitkeep`
**File**: `recommender_api/src/utils/.gitkeep`

(Empty files to preserve directory structure in git)

### Success Criteria:

#### Automated Verification:
- [x] Install dependencies: `cd recommender_api && npm install`
- [x] TypeScript compiles: `cd recommender_api && npm run typecheck`
- [x] Server starts locally (without Neo4j): `cd recommender_api && timeout 5 npm run dev || true` (will fail on Neo4j connection but should start)

#### Manual Verification:
- [ ] Review code structure matches assessments_api patterns
- [ ] Confirm console.log message format is correct

---

## Phase 3: Docker Configuration

### Overview
Create Dockerfile.dev for containerized development with tsx hot-reload.

### Changes Required:

#### 1. Dockerfile.dev
**File**: `recommender_api/Dockerfile.dev`

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install necessary packages
RUN apk add --no-cache curl bash

# Copy package files first for better caching
COPY recommender_api/package*.json ./
COPY recommender_api/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY recommender_api/src ./src

EXPOSE 4025

# Start with tsx watch for hot reload
CMD ["npm", "run", "dev"]
```

### Success Criteria:

#### Automated Verification:
- [x] Dockerfile syntax is valid: `docker build -f recommender_api/Dockerfile.dev -t test-build . --dry-run` (or similar check)

#### Manual Verification:
- [ ] Review Dockerfile follows assessments_api patterns

---

## Phase 4: Neo4j Helm Chart

### Overview
Create a Helm chart for Neo4j database deployment, following the assessments-db pattern.

### Changes Required:

#### 1. Chart.yaml
**File**: `helm_charts/neo4j-db/Chart.yaml`

```yaml
apiVersion: v2
name: neo4j-db
description: Helm chart for Neo4j Database
type: application
version: 0.1.0
appVersion: "5.26"
```

#### 2. values.yaml
**File**: `helm_charts/neo4j-db/values.yaml`

```yaml
replicaCount: 1

image:
  repository: neo4j
  tag: "5.26-community"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  boltPort: 7687
  httpPort: 7474

resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi

persistence:
  enabled: true
  size: 1Gi
  storageClass: ""

neo4j:
  auth:
    username: neo4j
    password: password
```

#### 3. templates/_helpers.tpl
**File**: `helm_charts/neo4j-db/templates/_helpers.tpl`

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "neo4j-db.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "neo4j-db.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "neo4j-db.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "neo4j-db.labels" -}}
helm.sh/chart: {{ include "neo4j-db.chart" . }}
app.kubernetes.io/name: {{ include "neo4j-db.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

#### 4. templates/pvc.yaml
**File**: `helm_charts/neo4j-db/templates/pvc.yaml`

```yaml
{{- if .Values.persistence.enabled }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "neo4j-db.fullname" . }}-pvc
  labels:
    {{- include "neo4j-db.labels" . | nindent 4 }}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: {{ .Values.persistence.size }}
  {{- if .Values.persistence.storageClass }}
  storageClassName: {{ .Values.persistence.storageClass }}
  {{- end }}
{{- end }}
```

#### 5. templates/deployment.yaml
**File**: `helm_charts/neo4j-db/templates/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "neo4j-db.fullname" . }}
  labels:
    {{- include "neo4j-db.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ include "neo4j-db.name" . }}
  template:
    metadata:
      labels:
        app: {{ include "neo4j-db.name" . }}
        release: {{ .Release.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: bolt
              containerPort: 7687
              protocol: TCP
            - name: http
              containerPort: 7474
              protocol: TCP
          env:
            - name: NEO4J_AUTH
              value: "{{ .Values.neo4j.auth.username }}/{{ .Values.neo4j.auth.password }}"
          volumeMounts:
            {{- if .Values.persistence.enabled }}
            - name: data
              mountPath: /data
            {{- end }}
          readinessProbe:
            tcpSocket:
              port: 7687
            initialDelaySeconds: 30
            periodSeconds: 10
          livenessProbe:
            tcpSocket:
              port: 7687
            initialDelaySeconds: 60
            periodSeconds: 20
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      volumes:
        {{- if .Values.persistence.enabled }}
        - name: data
          persistentVolumeClaim:
            claimName: {{ include "neo4j-db.fullname" . }}-pvc
        {{- end }}
```

#### 6. templates/service.yaml
**File**: `helm_charts/neo4j-db/templates/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "neo4j-db.fullname" . }}
  labels:
    {{- include "neo4j-db.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.boltPort }}
      targetPort: 7687
      protocol: TCP
      name: bolt
    - port: {{ .Values.service.httpPort }}
      targetPort: 7474
      protocol: TCP
      name: http
  selector:
    app: {{ include "neo4j-db.name" . }}
    release: {{ .Release.Name }}
```

### Success Criteria:

#### Automated Verification:
- [x] Helm lint passes: `helm lint helm_charts/neo4j-db`
- [x] Helm template renders: `helm template neo4j-db helm_charts/neo4j-db`

#### Manual Verification:
- [ ] Review chart structure matches assessments-db patterns
- [ ] Confirm Neo4j environment variables are correct

---

## Phase 5: API Helm Chart

### Overview
Create the Helm chart for the recommender-api deployment.

### Changes Required:

#### 1. Chart.yaml
**File**: `helm_charts/recommender-api/Chart.yaml`

```yaml
apiVersion: v2
name: recommender-api
description: Helm chart for Recommender API
type: application
version: 0.1.0
appVersion: "1.0"
```

#### 2. values.yaml
**File**: `helm_charts/recommender-api/values.yaml`

```yaml
replicaCount: 1

image:
  repository: recommender_api
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 4025
  targetPort: 4025

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 200m
    memory: 512Mi

env: {}
```

#### 3. values.dev.yaml
**File**: `helm_charts/recommender-api/values.dev.yaml`

```yaml
env:
  NODE_ENV: "development"
  PORT: "4025"
  NEO4J_URI: "bolt://neo4j-db.recommender.svc.cluster.local:7687"
  NEO4J_USER: "neo4j"
  NEO4J_PASSWORD: "password"

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 200m
    memory: 512Mi
```

#### 4. templates/_helpers.tpl
**File**: `helm_charts/recommender-api/templates/_helpers.tpl`

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "recommender-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "recommender-api.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "recommender-api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "recommender-api.labels" -}}
helm.sh/chart: {{ include "recommender-api.chart" . }}
app.kubernetes.io/name: {{ include "recommender-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

#### 5. templates/deployment.yaml
**File**: `helm_charts/recommender-api/templates/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "recommender-api.fullname" . }}
  labels:
    {{- include "recommender-api.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ include "recommender-api.name" . }}
  template:
    metadata:
      labels:
        app: {{ include "recommender-api.name" . }}
        release: {{ .Release.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
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
            timeoutSeconds: 10
            failureThreshold: 12
          readinessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.targetPort }}
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 2
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

#### 6. templates/service.yaml
**File**: `helm_charts/recommender-api/templates/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "recommender-api.fullname" . }}
  labels:
    {{- include "recommender-api.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    app: {{ include "recommender-api.name" . }}
    release: {{ .Release.Name }}
```

### Success Criteria:

#### Automated Verification:
- [x] Helm lint passes: `helm lint helm_charts/recommender-api`
- [x] Helm template renders: `helm template recommender-api helm_charts/recommender-api`
- [x] Helm template with dev values: `helm template recommender-api helm_charts/recommender-api -f helm_charts/recommender-api/values.dev.yaml`

#### Manual Verification:
- [ ] Review deployment template has correct health check paths
- [ ] Confirm environment variables are injected correctly

---

## Phase 6: Tiltfile

### Overview
Create the Tiltfile to orchestrate local development with live reload.

### Changes Required:

#### 1. Tiltfile
**File**: `Tiltfile`

```python
# -*- mode: Python -*-

# Allow connecting to minikube's Docker daemon
allow_k8s_contexts('minikube')

# Create namespace if it doesn't exist
load('ext://namespace', 'namespace_create')
namespace_create('recommender')

# ============================================
# Neo4j Database
# ============================================

k8s_yaml(helm(
    'helm_charts/neo4j-db',
    name='neo4j-db',
    namespace='recommender',
))

k8s_resource(
    'neo4j-db',
    labels=['recommender'],
    port_forwards=[
        '7687:7687',  # Bolt protocol
        '7474:7474',  # HTTP browser
    ],
)

# ============================================
# Recommender API
# ============================================

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

k8s_resource(
    'recommender-api',
    labels=['recommender'],
    port_forwards=['4025:4025'],
    resource_deps=['neo4j-db'],
)
```

### Success Criteria:

#### Automated Verification:
- [x] Tiltfile syntax is valid (Tilt will check on startup)

#### Manual Verification:
- [x] `tilt up` starts successfully
- [x] Neo4j database is accessible at `bolt://localhost:7687`
- [x] API is accessible at `http://localhost:4025/health`
- [x] Code changes in `recommender_api/src/` trigger live reload
- [x] Console shows "Recommender API is running on port 4025"

**Implementation Note**: After completing this phase, run `tilt up` and verify all services start correctly. Test the health endpoint and confirm live reload works by making a small change to `src/index.ts`.

---

## Testing Strategy

### Automated Tests:
- Helm lint for both charts
- TypeScript type checking
- Health endpoint returns 200

### Manual Testing Steps:
1. Run `tilt up` and wait for all resources to be ready
2. Open `http://localhost:4025/health` - should return "OK"
3. Open `http://localhost:7474` - Neo4j browser should load
4. Open `http://localhost:4025/db-health` - should return success JSON
5. Edit `src/index.ts`, change console.log message - should auto-reload
6. Check Tilt logs show the new message

## Performance Considerations

- Neo4j memory is limited to 2Gi in development
- API pod has 512Mi-1Gi memory allocation
- Single replica for local development (not HA)

## References

- Research document: `thoughts/shared/research/2025-12-29-assessments-api-setup-research.md`
- assessments_api patterns: `software_devs/coding-platform/assessments_api/`
- Helm charts reference: `software_devs/coding-platform/helm_charts/`
