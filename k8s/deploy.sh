#!/bin/bash
# deploy.sh - Deploy Fibonacci application to Kubernetes

set -e

echo "🚀 Deploying Fibonacci Application to Kubernetes"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if minikube is running
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster not accessible. Please start minikube:"
    echo "   minikube start"
    exit 1
fi

echo -e "${YELLOW}Step 1: Building Docker images...${NC}"
echo "Building images with minikube docker environment..."
eval $(minikube docker-env)

docker build -t fibonacci-main-service:latest -f Dockerfile.main .
docker build -t fibonacci-analytics-service:latest -f Dockerfile.analytics .
docker build -t fibonacci-portfolio-service:latest -f Dockerfile.portfolio .
docker build -t fibonacci-frontend:latest -f Dockerfile.frontend .

echo -e "${GREEN}✓ Images built successfully${NC}"

echo -e "\n${YELLOW}Step 2: Applying Kubernetes manifests...${NC}"

# Apply manifests in order
kubectl apply -f k8s/00-namespace.yaml
echo -e "${GREEN}✓ Namespace created${NC}"

kubectl apply -f k8s/01-configmap.yaml

if [ ! -f k8s/02-secret.yaml ]; then
    echo "❌ k8s/02-secret.yaml not found."
    echo "   Generate it first with:"
    echo "     ./k8s/generate_secret.sh"
    echo "   (or set DB_PASSWORD / SECRET_KEY / COINGECKO_API_KEY env vars before running)"
    exit 1
fi
kubectl apply -f k8s/02-secret.yaml
echo -e "${GREEN}✓ ConfigMap and Secret created${NC}"

kubectl apply -f k8s/03-postgres.yaml
echo -e "${GREEN}✓ PostgreSQL deployed${NC}"

echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n fibonacci --timeout=120s

kubectl apply -f k8s/04-analytics-service.yaml
kubectl apply -f k8s/05-portfolio-service.yaml
echo -e "${GREEN}✓ Microservices deployed${NC}"

kubectl apply -f k8s/06-main-service.yaml
echo -e "${GREEN}✓ Main service deployed${NC}"

kubectl apply -f k8s/07-frontend.yaml
echo -e "${GREEN}✓ Frontend deployed${NC}"

kubectl apply -f k8s/08-hpa.yaml
echo -e "${GREEN}✓ Autoscalers configured${NC}"

echo -e "\n${YELLOW}Step 3: Waiting for deployments to be ready...${NC}"
kubectl wait --for=condition=available deployment --all -n fibonacci --timeout=300s

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Deployment Status:"
kubectl get pods -n fibonacci
echo ""
kubectl get svc -n fibonacci

echo ""
echo "🌐 Access the application:"
echo "   Run: minikube service frontend-service -n fibonacci"
echo ""
echo "📈 Monitor resources:"
echo "   kubectl get pods -n fibonacci -w"
echo "   kubectl get hpa -n fibonacci -w"
echo ""
echo "🔍 View logs:"
echo "   kubectl logs -f deployment/main-service -n fibonacci"
echo "   kubectl logs -f deployment/analytics-service -n fibonacci"
echo "   kubectl logs -f deployment/portfolio-service -n fibonacci"
