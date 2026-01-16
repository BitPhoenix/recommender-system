#!/bin/bash

# Tilt Development Environment Startup Script
# This script starts the Tilt development environment for recommender_system

set -e

# Check if tilt is installed
if ! command -v tilt &> /dev/null; then
    echo "Error: tilt is not installed."
    echo "Install it from: https://docs.tilt.dev/install.html"
    exit 1
fi

# Start minikube if not running
if ! minikube status 2>/dev/null | grep -q "Running"; then
    echo "Starting minikube..."

    # Disconnect containers from minikube network to free up IPs
    containers=$(docker network inspect minikube -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || true)
    for container in $containers; do
        if [ "$container" != "minikube" ]; then
            echo "  Disconnecting $container"
            docker network disconnect minikube "$container" 2>/dev/null || true
        fi
    done

    # Check for corrupted minikube state
    if minikube status 2>&1 | grep -q "error\|Error"; then
        echo "Detected corrupted minikube state, cleaning up..."
        minikube delete || true
        docker network rm minikube 2>/dev/null || true
    fi

    # Start minikube
    minikube start

    # Reconnect containers
    for container in $containers; do
        if [ "$container" != "minikube" ]; then
            if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
                echo "  Reconnecting $container"
                docker network connect minikube "$container" 2>/dev/null || true
            fi
        fi
    done
else
    echo "Minikube already running"
fi

# Enable ingress addon if not already enabled
if ! minikube addons list | grep -q "ingress.*enabled"; then
    echo "Enabling ingress addon..."
    minikube addons enable ingress
fi

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Determine bind address for port forwards
# Auto-detect Tailscale if available, otherwise default to localhost
BIND_ADDR="127.0.0.1"
TAILSCALE_HOSTNAME=""

if command -v tailscale &> /dev/null; then
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
    if [[ -n "$TAILSCALE_IP" ]]; then
        BIND_ADDR="$TAILSCALE_IP"
        # Get the Tailscale hostname (lowercase for consistency)
        TAILSCALE_HOSTNAME=$(tailscale status --self --json 2>/dev/null | jq -r '.Self.HostName' | tr '[:upper:]' '[:lower:]')
        echo "Detected Tailscale:"
        echo "  Bind address: $BIND_ADDR"
        echo "  Hostname: $TAILSCALE_HOSTNAME"
    fi
fi

export TILT_BIND_ADDR="$BIND_ADDR"
export TILT_TAILSCALE_HOSTNAME="$TAILSCALE_HOSTNAME"

# Detect TLS certificate files in certs/ directory
TAILSCALE_CERT=""
TAILSCALE_KEY=""
TAILSCALE_DOMAIN=""

if [[ -n "$TAILSCALE_HOSTNAME" ]]; then
    # Look for any .crt and .key files in certs/
    CERT_FILE=$(find certs -name "*.crt" -type f 2>/dev/null | head -1)
    KEY_FILE=$(find certs -name "*.key" -type f 2>/dev/null | head -1)

    if [[ -n "$CERT_FILE" && -n "$KEY_FILE" ]]; then
        TAILSCALE_CERT="$CERT_FILE"
        TAILSCALE_KEY="$KEY_FILE"
        # Extract the tailnet domain from the cert filename (e.g., mac-studio.tailb9e408.ts.net)
        TAILSCALE_DOMAIN=$(basename "$CERT_FILE" .crt)
        echo "  TLS cert: $TAILSCALE_CERT"
        echo "  TLS key: $TAILSCALE_KEY"
        echo "  Domain: $TAILSCALE_DOMAIN"
    fi
fi

export TILT_TAILSCALE_CERT="$TAILSCALE_CERT"
export TILT_TAILSCALE_KEY="$TAILSCALE_KEY"
export TILT_TAILSCALE_DOMAIN="$TAILSCALE_DOMAIN"

echo "Starting Tilt development environment..."
echo ""
echo "Services managed by Tilt:"
echo "  - recommender_api (Node.js API)"
echo "  - recommender_client (React frontend)"
echo "  - neo4j (Graph database)"
echo "  - neo4j-seed (Database seeding)"
echo ""
echo "Port forwards (after startup) - binding to $BIND_ADDR:"
echo "  - client:       http://$BIND_ADDR:5173"
echo "  - api:          http://$BIND_ADDR:4025"
echo "  - neo4j bolt:   bolt://$BIND_ADDR:7687"
echo "  - neo4j http:   http://$BIND_ADDR:7474"
echo ""

if [[ -n "$TAILSCALE_HOSTNAME" ]]; then
    echo "Remote access via hostname (from other Tailscale devices):"
    echo "  - Tilt UI:      http://$TAILSCALE_HOSTNAME:10351"
    if [[ -n "$TAILSCALE_DOMAIN" ]]; then
        echo "  - client:       https://$TAILSCALE_DOMAIN:5173"
    fi
    echo "  - api:          http://$TAILSCALE_HOSTNAME:4025"
    echo "  - neo4j http:   http://$TAILSCALE_HOSTNAME:7474"
    echo ""
fi

# Start Tilt (use unique webdev-port to avoid conflicts with other Tilt instances)
tilt up --host "$BIND_ADDR" --port 10351 --webdev-port 46765
