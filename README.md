# Fibonacci Trading Journal

A cloud-native trading management platform built with microservice architecture and Kubernetes orchestration, designed to provide comprehensive trade tracking, advanced analytics, and real-time cryptocurrency portfolio monitoring.

## 🎓 Academic Context

**Course:** INFS3208 Cloud Computing  
**Project Type:** Type I - Highly Scalable and Available Web Application  
**Deployment:** Local Development with Minikube

This project demonstrates the practical application of cloud computing concepts including containerization, orchestration, horizontal scaling, and fault tolerance patterns.

## 🏗️ Architecture Overview

The system implements a microservice architecture with four main components:

- **Frontend Service** (React + Nginx): User interface with responsive design
- **Main Service** (Django REST Framework): Authentication, trade CRUD operations
- **Analytics Service** (FastAPI): Performance metrics and statistical calculations
- **Portfolio Service** (FastAPI): Real-time cryptocurrency pricing via Binance API
- **PostgreSQL Database**: Persistent storage for all application data

## 🚀 Local Development Setup

### Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) - Local Kubernetes cluster
- [Docker](https://docs.docker.com/get-docker/) - Container runtime
- [kubectl](https://kubernetes.io/docs/tasks/tools/) - Kubernetes command-line tool

### Complete Setup Process

```bash
# Stop and delete any existing Minikube cluster
minikube stop
minikube delete

# Start fresh Minikube cluster
minikube start

# Navigate to project directory
cd /path/to/your/project

# Configure Docker to use Minikube's Docker daemon
eval $(minikube docker-env)

# Build all service images
docker build -t fibonacci-main-service:latest -f Dockerfile.main .
docker build -t fibonacci-analytics-service:latest -f Dockerfile.analytics .
docker build -t fibonacci-portfolio-service:latest -f Dockerfile.portfolio .
docker build -t fibonacci-frontend:latest -f Dockerfile.frontend .

# Deploy Kubernetes resources
cd k8s
./deploy.sh

# Create demo user for application access
kubectl exec -it $(kubectl get pods -n fibonacci -l app=main-service -o jsonpath='{.items[0].metadata.name}') -n fibonacci -- python manage.py shell -c "from django.contrib.auth.models import User; User.objects.filter(username='demo').delete(); User.objects.create_superuser('demo', 'demo@example.com', 'demo123'); print('✅ Admin user created: demo / demo123')"
```

### Accessing the Application

```bash
# Get the frontend service URL
minikube service fibonacci-frontend -n fibonacci --url

# Or access via port-forward
kubectl port-forward -n fibonacci service/fibonacci-frontend 3000:80
```

**Demo Credentials:**
- Username: `demo`
- Password: `demo123`

## 📦 Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **Vite** - Fast build tool and development server
- **TailwindCSS** - Utility-first CSS framework
- **Recharts** - Composable charting library ([Documentation](https://recharts.org/))
- **TradingView Widgets** - Professional trading charts
- **Nginx** - High-performance web server

### Backend Services
- **Django 5.2** - Main service with REST Framework ([Documentation](https://www.djangoproject.com/))
- **FastAPI** - Analytics and Portfolio services ([Documentation](https://fastapi.tiangolo.com/))
- **Python 3.11** - Modern Python with performance improvements

### Database
- **PostgreSQL 16** - Robust relational database ([Documentation](https://www.postgresql.org/docs/))

### External APIs
- **Binance API** - Real-time cryptocurrency data ([Documentation](https://binance-docs.github.io/apidocs/spot/en/))

### Infrastructure
- **Docker** - Containerization ([Documentation](https://docs.docker.com/))
- **Kubernetes** - Container orchestration ([Documentation](https://kubernetes.io/docs/))
- **Minikube** - Local Kubernetes environment ([Documentation](https://minikube.sigs.k8s.io/docs/))

### 💸 Monthly Cost Estimate (GCP) — snapshot from montly_cost_gcp.csv

Estimated monthly costs (snapshot). Confirm the source CSV before publishing.

| Resource                       | Unit       | Quantity | Unit Price (USD) | Monthly Cost (USD) |
|-------------------------------|------------:|---------:|-----------------:|-------------------:|
| GKE nodes (n1-standard-2)     | per node   |        3 | 0.075 / hr       | 162.00             |
| Cloud SQL (Postgres)          | instance   |        1 | 0.030 / hr       | 21.60              |
| Load Balancer                 | monthly    |        1 | 7.30             | 7.30               |
| Persistent Disk (Postgres PV) | GB         |       50 | 0.02 / GB        | 1.00               |
| Container Registry storage    | monthly    |        1 | 0.10             | 0.10               |
| Egress (approx.)              | GB         |       50 | 0.12 / GB        | 6.00               |
| **Total (estimated)**         |            |          |                  | **198.00**         |

Notes:
- Values are a CSV snapshot; verify montly_cost_gcp.csv before committing.
- Unit prices vary by region, sustained/committed use — validate with GCP Pricing Calculator for production.
- To regenerate from CSV (csvkit):  
    csvcut -c Resource,Unit,Quantity,UnitPrice,MonthlyCost montly_cost_gcp.csv | csvlook
- Roundings applied; treat this as an estimate.

### 1. User Authentication
- JWT-based security system
- User data isolation
- Secure session management

### 2. Trade Management
- Complete CRUD operations for trade records
- Entry/exit price tracking
- Position sizing calculations
- Profit & Loss (P&L) analytics

### 3. Advanced Analytics
- Win rate calculations
- Profit factor analysis
- Sharpe ratio computation
- Risk-adjusted returns
- Visual performance charts

### 4. Cryptocurrency Portfolio Tracking
- Real-time pricing integration with Binance API
- Historical price data analysis
- Portfolio value tracking
- Multi-asset support

### 5. Strategy Management
- Custom trading strategy organization
- Strategy-specific performance analysis
- Comparative analytics across strategies

### 6. Forex Session Tracking
- Global trading session indicators
- Session overlap visualization
- Market activity tracking

## 🔧 Kubernetes Configuration

### Deployments
- **Replicas:** 2-5 pods per service (configurable)
- **Health Probes:** Liveness and readiness checks
- **Resource Limits:** CPU and memory constraints defined
- **Rolling Updates:** Zero-downtime deployment strategy

### Services
- **ClusterIP:** Internal service communication
- **LoadBalancer:** External access to frontend

### Storage
- **Persistent Volumes:** Database data persistence
- **Volume Claims:** 5Gi PostgreSQL storage

### Autoscaling
- **Horizontal Pod Autoscaler (HPA):** Automatic scaling based on metrics
- **CPU Threshold:** 70% utilization
- **Memory Threshold:** 80% utilization

## 📊 Cloud Computing Concepts Demonstrated

### Scalability
- Horizontal Pod Autoscaler for elastic scaling
- Load balancing across service replicas
- Stateless service design for easy replication

### High Availability
- Multiple replicas per service
- Self-healing pod management
- Persistent volume for data durability

### Fault Tolerance
- Health probe monitoring
- Automatic pod replacement
- Graceful degradation patterns

### Zero-Downtime Deployments
- Rolling update strategy (maxSurge: 1, maxUnavailable: 0)
- Health check validation before traffic routing
- Instant rollback capability

## 🛠️ Development Notes

### AI Assistance

This project utilized AI assistance in the following areas:

1. **Build Script Generation:** AI tools were used to help create and optimize the shell scripts (`.sh` files) for automated deployment processes, ensuring proper error handling and idempotent operations.

2. **Debugging Support:** AI assistance was valuable in debugging configuration issues, particularly with Kubernetes manifests, Docker networking, and service communication patterns.

## 📚 References & Documentation

### Core Technologies
- [Kubernetes Official Documentation](https://kubernetes.io/docs/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Django Documentation](https://docs.djangoproject.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

### Libraries & Frameworks
- [Recharts Documentation](https://recharts.org/) - Charting library
- [TailwindCSS Documentation](https://tailwindcss.com/docs) - CSS framework
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - Database
- [Nginx Documentation](https://nginx.org/en/docs/) - Web server
- [Vite Documentation](https://vitejs.dev/) - Build tool

### External APIs
- [Binance API Documentation](https://binance-docs.github.io/apidocs/spot/en/) - Cryptocurrency data
- [Binance Spot API Reference](https://binance-docs.github.io/apidocs/spot/en/#change-log) - Endpoint specifications

### Learning Resources
- [Kubernetes Patterns](https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/) - Deployment strategies
- [Twelve-Factor App Methodology](https://12factor.net/) - Cloud-native principles
- [Microservices Architecture](https://microservices.io/) - Design patterns

## 🎓 Learning Outcomes

This project provided hands-on experience with:

1. **Container Orchestration:** Understanding Kubernetes concepts including pods, services, deployments, and scaling
2. **Microservice Design:** Implementing service decomposition and inter-service communication
3. **Cloud-Native Patterns:** Applying 12-factor app principles and stateless design
4. **DevOps Practices:** CI/CD concepts, infrastructure as code, and automated deployments
5. **High Availability Design:** Implementing redundancy, health checks, and graceful degradation
6. **Resource Management:** Configuring resource limits, requests, and autoscaling policies

## 📝 Future Enhancements

Potential improvements for production deployment:

- [ ] Implement CI/CD pipeline with GitHub Actions
- [ ] Add monitoring and observability (Prometheus + Grafana)
- [ ] Implement centralized logging (ELK Stack)
- [ ] Add API rate limiting and caching (Redis)
- [ ] Implement service mesh (Istio) for advanced traffic management
- [ ] Add integration tests and E2E testing
- [ ] Configure TLS/SSL certificates for secure communication
- [ ] Implement backup and disaster recovery procedures

## 📄 License

This is an academic project developed for INFS3208 Cloud Computing course.

## 🙏 Acknowledgments

- University of Queensland - INFS3208 Cloud Computing Course
- Kubernetes Community for excellent documentation
- Open-source contributors to all libraries used

---

**Note:** This project is deployed locally on Minikube for academic demonstration purposes. While it showcases production-ready cloud-native patterns, additional configurations would be required for actual production deployment on cloud platforms like GCP, AWS, or Azure.