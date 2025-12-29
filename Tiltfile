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
