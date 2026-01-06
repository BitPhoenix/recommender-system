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
# Neo4j Seed Job
# ============================================

local_resource(
    'neo4j-seed',
    cmd='eval $(minikube docker-env) && docker build -f seeds/Dockerfile -t neo4j-seed:latest . && kubectl delete job -n recommender -l app=neo4j-seed --ignore-not-found && helm upgrade --install neo4j-seed helm_charts/neo4j-seed --namespace recommender --values helm_charts/neo4j-seed/values.dev.yaml --set image.repository=neo4j-seed --set image.tag=latest --set image.pullPolicy=Never',
    deps=[
        'seeds/seed.ts',
        'seeds/skills.ts',
        'seeds/engineers.ts',
        'seeds/stories.ts',
        'seeds/assessments.ts',
        'seeds/types.ts',
        'seeds/index.ts',
    ],
    resource_deps=['neo4j-db'],
    labels=['recommender'],
    auto_init=True,
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
