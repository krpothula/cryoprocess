# CryoProcess Node.js Backend

Complete Node.js backend for CryoProcess - Cryo-EM data processing pipeline web interface.

## Features

### Completed
- [x] Express.js server with MongoDB
- [x] JWT Authentication (login/register)
- [x] Project management (CRUD)
- [x] Import job submission
- [x] MRC file parser (pure Node.js)
- [x] STAR file parser
- [x] Job submission (local & SLURM)
- [x] Static frontend serving

### In Progress
- [ ] All job builders (Motion, CTF, AutoPick, etc.)
- [ ] Dashboard APIs
- [ ] SLURM monitoring
- [ ] WebSocket real-time updates
- [ ] User management (admin)
- [ ] Cluster configuration

## Quick Start

```bash
cd backend
npm install
cp .env.example .env  # Edit as needed
npm start
```

Access: http://localhost:8001

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `DELETE /api/projects/:id` - Delete project

### Jobs
- `POST /api/jobs/:jobType` - Submit job
- `GET /api/jobs/:jobId` - Get job details
- `GET /api/jobs/:jobType/results/:jobId` - Get results
- `GET /api/jobs/:jobType/summary` - Job summary

### Import
- `GET /api/import/results/:jobId` - Import results
- `GET /api/import/movie-frame` - Movie frame
- `POST /api/import/parse-star` - Parse STAR file
- `POST /api/import/mrc-info` - MRC file info

### Files
- `GET /api/files/browse` - Browse folders
- `POST /api/files/select` - Select files

## Environment Variables

```env
PORT=8001
MONGODB_URI=mongodb://localhost:27017/cryoprocess
JWT_SECRET=your-secret-key
ROOT_PATH=/path/to/projects
SLURM_PARTITION=default
```

## Architecture

```
backend/
├── src/
│   ├── server.js           # Express entry point
│   ├── config/             # Database, settings
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Auth, error handling
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API routes
│   ├── services/           # Job builders, SLURM
│   ├── utils/              # Parsers, helpers
│   └── validators/         # Joi schemas
├── static/                 # Built React frontend
└── package.json
```

## Migration from Django

This is a complete rewrite of the Django backend in Node.js for:
- Unified JavaScript stack (React frontend + Node.js backend)
- Better WebSocket support
- Simplified deployment
- No Celery/Redis dependencies

## License

Proprietary - CryoProcess
