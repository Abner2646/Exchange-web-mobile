# 🚀 Full-Stack Web System with Docker

## 📋 Main Components

### 🎯 General Architecture
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Nginx     │    │   React     │    │   Express   │
│  (Proxy)    │◄──►│ (Frontend)  │◄──►│  (Backend)  │
│   :80       │    │   :3000     │    │   :3001     │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                   ┌─────────────┐    ┌─────────────┐
                   │    Redis    │    │ PostgreSQL  │
                   │  (Cache)    │    │    (DB)     │
                   │   :6379     │    │   :5432     │
                   └─────────────┘    └─────────────┘
```

### 🔧 System Services

| Service | Technology | Port | Function |
|----------|------------|--------|---------|
| **Frontend** | React 18 | 3000 | User interface |
| **Backend** | Express + Sequelize | 3001 | API REST |
| **Database** | PostgreSQL 15 | 5432 | Main database |
| **Cache** | Redis 7 | 6379 | Cache and sessions |
| **Proxy** | Nginx | 80 | Reverse proxy |
| **pgAdmin** | pgAdmin 4 | 5050 | DB Administration |

---

## 🏗️ Initial Construction

### 1️⃣ Preparing the Environment
```bash
# Create project structure
./setup-directories.sh my-project

# Navigate to the project
cd my-project

# Create configuration files
cp .env.example .env
```

### 2️⃣ Variable Configuration
```bash
# Edit .env with your values
nano .env
```

### 3️⃣ First Construction
```bash
# Build all images
docker-compose build

# Initialize database and services
docker-compose up -d
```

---

## 📚 Important File Structure

```
project/
├── docker-compose.yml          # Service orchestration
├── .env                        # Environment variables
├── .gitignore                  # Files to ignore in Git
│
├── frontend/
│   ├── Dockerfile.dev          # Docker image for dev
│   ├── package.json            # React dependencies
│   └── src/                    # React source code
│
├── backend/
│   ├── Dockerfile.dev          # Docker image for dev
│   ├── package.json            # Express dependencies
│   ├── server.js               # Main server
│   ├── models/                 # Sequelize models
│   └── routes/                 # API routes
│
├── database/
│   └── init.sql                # DB initialization script
│
└── nginx/
    └── nginx.conf              # Proxy configuration

```

---

## 📚 Estructura de Archivos Importantes

```
project/
├── docker-compose.yml          # Service orchestration
├── .env                        # Environment variables
├── .env.example                # Environment template
├── .gitignore                  # Files to ignore in Git
├── README.md                   # Project documentation
│
├── frontend/
│   ├── Dockerfile.dev          # Docker image for dev
│   ├── package.json            # React dependencies
│   ├── public/
│   │   ├── index.html          # Main HTML page
│   │   └── manifest.json       # PWA configuration
│   └── src/
│       ├── App.js              # Main component
│       ├── index.js            # Entry point
│       ├── components/         # Reusable components
│       ├── pages/              # App pages
│       ├── services/           # API services
│       └── utils/              # Utilities
│
├── backend/
│   ├── Dockerfile.dev          # Docker image for dev
│   ├── package.json            # Express dependencies
│   ├── server.js               # Main server
│   ├── config/
│   │   └── database.js         # Sequelize config
│   ├── models/
│   │   └── index.js            # Sequelize models
│   ├── controllers/            # Business logic
│   ├── routes/                 # API routes
│   │   └── index.js            # Main routes
│   ├── middleware/             # Custom middlewares
│   ├── migrations/             # DB migrations
│   └── seeders/                # Seed data
│
├── database/
│   └── init.sql                # DB initialization script
│
├── nginx/
│   └── nginx.conf              # Proxy configuration
│
├── pgadmin/
│   ├── servers.json            # Server config
│   └── pgpass                  # DB credentials
│
└── scripts/
    └── setup-directories.sh   # Initialization script

```

<!-- push test: 2026-08-21T07:05:57Z -->
