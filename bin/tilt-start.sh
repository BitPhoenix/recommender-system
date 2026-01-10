#!/bin/bash
set -e

# Change to project root directory
cd "$(dirname "$0")/.."

# Check if minikube is running
if ! minikube status &>/dev/null; then
    echo "Starting minikube..."
    minikube start
fi

# Configure shell to use minikube's Docker daemon
echo "Configuring Docker environment for minikube..."
eval $(minikube docker-env)

# Start Tilt
echo "Starting Tilt..."
tilt up --port 10351
