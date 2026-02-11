# CryoProcess Installation Guide

Web-based graphical interface for RELION cryo-EM data processing with SLURM cluster integration.

---

## Quick Start (3 commands)

```bash
git clone https://github.com/krpothula/cryoprocess.git
cd cryoprocess
chmod +x cryoprocess.sh
```

```bash
./cryoprocess.sh prerequisites    # Installs Node.js + MongoDB
./cryoprocess.sh install           # Installs app, builds frontend, creates admin user
./cryoprocess.sh start             # Starts server
```

Open **http://localhost:8001** in your browser.

| Default Login | |
|---|---|
| Email | `admin@example.com` |
| Password | `admin123` |

> Change the password after first login.

---

## System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 20.04, CentOS 7, RHEL 8 | Ubuntu 22.04+ |
| RAM | 8 GB | 16 GB+ |
| Node.js | 18+ | 20+ |
| MongoDB | 6.0+ | 8.0 |
| RELION | 4.0+ | 5.0 |
| GPU | NVIDIA with CUDA (for RELION GPU jobs) | |
| SLURM | Any recent version | |

CryoProcess itself is lightweight. The RAM and GPU requirements are for RELION processing, not for CryoProcess.

---

## Step-by-Step Installation

### Step 1: Install Prerequisites

```bash
./cryoprocess.sh prerequisites
```

This detects your Linux distribution and installs:
- **Node.js 20** (from NodeSource)
- **MongoDB 8.0** (from MongoDB official repo)
- **Build tools** (git, curl, gcc, make)

**Supported distributions:** Ubuntu, Debian, Linux Mint, Pop!_OS, CentOS, RHEL, Rocky Linux, AlmaLinux, Fedora

If your distribution is not supported, install Node.js 18+ and MongoDB 6.0+ manually, then skip to Step 2.

### Step 2: Install Application

```bash
./cryoprocess.sh install
```

This will:
1. Check that Node.js and npm are installed
2. Create `backend/.env` from the template
3. Generate a secure random JWT secret
4. Prompt you for two paths:
   - **Data root path** — where your cryo-EM projects are stored (e.g., `/shared/data`)
   - **RELION container path** — path to your RELION Singularity `.sif` file (leave empty if RELION is installed natively)
5. Install backend and frontend dependencies (`npm install`)
6. Build the React frontend for production
7. Create the default admin user in MongoDB

### Step 3: Start

```bash
./cryoprocess.sh start
```

The server starts on port **8001** by default. You'll see:

```
==============================================
  CryoProcess Node.js is running!
==============================================

  URL:      http://localhost:8001
  Login:    admin@example.com / admin123
```

---

## Available Commands

| Command | Description |
|---|---|
| `./cryoprocess.sh prerequisites` | Install system dependencies (Node.js, MongoDB) |
| `./cryoprocess.sh install` | Setup application (install packages, build frontend, create admin) |
| `./cryoprocess.sh start` | Start production server |
| `./cryoprocess.sh stop` | Stop server |
| `./cryoprocess.sh restart` | Restart server |
| `./cryoprocess.sh status` | Check server and MongoDB status |
| `./cryoprocess.sh logs` | View server logs (Ctrl+C to exit) |
| `./cryoprocess.sh build` | Rebuild frontend after code changes |
| `./cryoprocess.sh dev` | Start in development mode with auto-reload |

---

## MongoDB and cryoSPARC Coexistence

**If you already have cryoSPARC installed, there is no conflict.**

cryoSPARC runs its own private MongoDB instance on port **39001** inside its installation directory. CryoProcess uses the system MongoDB on port **27017** with a separate database called `cryoprocess-db`. The two never interact.

| Component | MongoDB Port | Database |
|---|---|---|
| CryoProcess | 27017 (system) | `cryoprocess-db` |
| cryoSPARC | 39001 (private) | `cryosparc_db` (internal) |

**If system MongoDB is already installed**, the `prerequisites` command will detect it and skip MongoDB installation. CryoProcess creates its own database and does not modify any existing databases.

**If MongoDB is not installed**, the `prerequisites` command will install MongoDB 8.0 from the official repository and start it as a system service.

### MongoDB Authentication (Optional)

By default, MongoDB only accepts connections from localhost (`bindIp: 127.0.0.1`), so no authentication is needed for single-machine setups.

For multi-machine facilities where MongoDB is exposed on the network, you can enable authentication:

```bash
# 1. Connect to MongoDB and create a dedicated user
mongosh
```

```javascript
use cryoprocess-db
db.createUser({
  user: "cryoprocess",
  pwd: "your-secure-password",
  roles: [{ role: "readWrite", db: "cryoprocess-db" }]
})
```

```bash
# 2. Enable authentication in MongoDB config
sudo nano /etc/mongod.conf
```

```yaml
security:
  authorization: enabled
```

```bash
# 3. Restart MongoDB
sudo systemctl restart mongod

# 4. Update CryoProcess connection string
nano backend/.env
```

```bash
DATABASE_URL=mongodb://cryoprocess:your-secure-password@localhost:27017/cryoprocess-db?authSource=cryoprocess-db
```

This gives CryoProcess `readWrite` access to only its own database. It cannot access any other databases on the same MongoDB server.

---

## Configuration Reference

After installation, all settings are in `backend/.env`. The install script configures sensible defaults — you only need to edit this file if you want to change something.

### Required Paths

```bash
# Where your cryo-EM data is stored
ROOT_PATH=/shared/data

# Path to RELION Singularity container (.sif file)
# Leave empty if RELION is installed natively on compute nodes
RELION_PATH=/shared/apps/relion.sif
```

| Variable | Description |
|---|---|
| `ROOT_PATH` | Base directory for cryo-EM data. Users can only browse files within this path. |
| `RELION_PATH` | Full path to the RELION Singularity `.sif` file. Leave empty if RELION binaries are directly available on the PATH of compute nodes. |

### Server Settings

```bash
PORT=8001
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the server listens on | `8001` |
| `NODE_ENV` | Environment mode (`production` or `development`) | `production` |
| `CORS_ORIGIN` | Allowed CORS origin (only needed for separate frontend dev server) | `http://localhost:3000` |

### Database

```bash
DATABASE_URL=mongodb://localhost:27017/cryoprocess-db
```

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Full MongoDB connection URI | `mongodb://localhost:27017/cryoprocess-db` |

### Authentication

```bash
JWT_SECRET=auto-generated-by-setup
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
```

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret key for signing JWT tokens. Auto-generated during install. |
| `ADMIN_USERNAME` | Default admin username (used during initial database setup). |
| `ADMIN_PASSWORD` | Default admin password (used during initial database setup). |

### SLURM Configuration

```bash
SLURM_PARTITION=batch
SLURM_NODES=1
SLURM_CPUS_PER_TASK=8
SLURM_GPUS_PER_NODE=1
SLURM_TIME=24:00:00
```

| Variable | Description | Default |
|---|---|---|
| `SLURM_PARTITION` | SLURM partition (queue) name | `batch` |
| `SLURM_NODES` | Number of nodes per job | `1` |
| `SLURM_CPUS_PER_TASK` | CPU cores per task | `8` |
| `SLURM_GPUS_PER_NODE` | GPUs per node (for GPU-accelerated RELION jobs) | `1` |
| `SLURM_TIME` | Maximum job walltime (`HH:MM:SS`) | `24:00:00` |

#### Remote SLURM (Optional)

If CryoProcess runs on a separate machine from the SLURM cluster (e.g., a web server that submits jobs to a login node via SSH):

```bash
SLURM_USE_SSH=true
SLURM_SSH_HOST=cluster-login.example.edu
SLURM_SSH_USER=cryoem
SLURM_SSH_PORT=22
```

| Variable | Description | Default |
|---|---|---|
| `SLURM_USE_SSH` | Enable SSH-based SLURM submission | `false` |
| `SLURM_SSH_HOST` | Hostname of the SLURM login node | |
| `SLURM_SSH_USER` | SSH username | |
| `SLURM_SSH_PORT` | SSH port | `22` |

> Ensure passwordless SSH (key-based auth) is configured between the CryoProcess server and the SLURM login node.

### Singularity Settings

```bash
SINGULARITY_BIND_PATHS=/shared/data:/shared/data
SINGULARITY_OPTIONS=--nv
```

| Variable | Description | Default |
|---|---|---|
| `SINGULARITY_BIND_PATHS` | Directories to mount inside the container (`host:container`) | |
| `SINGULARITY_OPTIONS` | Additional Singularity flags. `--nv` enables NVIDIA GPU passthrough. | `--nv` |

**Common bind paths:**

| Path | Purpose |
|---|---|
| `/shared/data:/shared/data` | Cryo-EM project data |
| `/scratch:/scratch` | Fast temporary storage |
| `/shared/apps:/shared/apps` | Shared software (CTFFIND, etc.) |

### External Software (Optional)

Paths to standalone cryo-EM tools. Leave empty if not installed or if they are included in your RELION container.

```bash
CTFFIND_EXE=
MOTIONCOR2_EXE=
GCTF_EXE=
RESMAP_EXE=
```

| Variable | Description |
|---|---|
| `CTFFIND_EXE` | Path to CTFFIND4 binary |
| `MOTIONCOR2_EXE` | Path to MotionCor2 binary |
| `GCTF_EXE` | Path to Gctf binary (GPU-accelerated CTF) |
| `RESMAP_EXE` | Path to ResMap binary (local resolution) |

---

## Complete Example `.env`

```bash
# =============================================================================
# CryoProcess Configuration
# =============================================================================

# REQUIRED - Edit for your system
ROOT_PATH=/shared/data
RELION_PATH=/shared/apps/relion-5.0.sif

# Server
PORT=8001
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=mongodb://localhost:27017/cryoprocess-db

# Auth (auto-generated)
JWT_SECRET=a1b2c3d4e5f6...your-random-hex-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# SLURM
SLURM_PARTITION=gpu
SLURM_NODES=1
SLURM_CPUS_PER_TASK=8
SLURM_GPUS_PER_NODE=1
SLURM_TIME=48:00:00

SLURM_USE_SSH=false
SLURM_SSH_HOST=
SLURM_SSH_USER=
SLURM_SSH_PORT=22

# Singularity
SINGULARITY_BIND_PATHS=/shared/data:/shared/data,/scratch:/scratch
SINGULARITY_OPTIONS=--nv

# External Software (optional)
CTFFIND_EXE=/shared/apps/cisTEM/bin/ctffind
MOTIONCOR2_EXE=
GCTF_EXE=
RESMAP_EXE=
```

---

## Deployment Options

### Option A: Same Machine as SLURM (Simplest)

Install CryoProcess on a SLURM login node or a compute node that has access to `sbatch`, `squeue`, and `sacct`.

```
┌─────────────────────────────────────────┐
│  Login Node / Head Node                 │
│                                         │
│  CryoProcess (Node.js) ──► sbatch      │
│  MongoDB                   squeue      │
│  Browser access: :8001     sacct       │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │ Compute  │ │ Compute  │ │ GPU    │  │
│  │ Node 1   │ │ Node 2   │ │ Node 1 │  │
│  └──────────┘ └──────────┘ └────────┘  │
└─────────────────────────────────────────┘
```

- Set `SLURM_USE_SSH=false`
- RELION and shared data must be accessible from compute nodes (NFS/Lustre/GPFS)

### Option B: Separate Web Server + SSH to SLURM

Install CryoProcess on a dedicated web server that submits jobs to the cluster via SSH.

```
┌──────────────┐     SSH      ┌──────────────────┐
│  Web Server  │ ──────────►  │  SLURM Cluster   │
│              │              │                  │
│  CryoProcess │              │  sbatch/squeue   │
│  MongoDB     │              │  Compute nodes   │
│  :8001       │              │  GPU nodes       │
└──────────────┘              └──────────────────┘
```

- Set `SLURM_USE_SSH=true` and configure SSH host/user
- Both machines must have access to the shared filesystem (NFS mount)

### Option C: RELION Without Singularity

If RELION is installed natively on compute nodes (not in a container):

```bash
# Leave RELION_PATH empty
RELION_PATH=

# Singularity settings are ignored when RELION_PATH is empty
SINGULARITY_BIND_PATHS=
SINGULARITY_OPTIONS=
```

CryoProcess will call RELION commands directly (e.g., `relion_run_motioncorr`) instead of wrapping them in `singularity exec`.

---

## Accessing Remotely

### Option 1: Direct Access (Same Network)

If the server is at `192.168.1.50`:

```
http://192.168.1.50:8001
```

### Option 2: SSH Tunnel (Secure Remote Access)

From your laptop:

```bash
ssh -L 8001:localhost:8001 user@server-hostname
```

Then open `http://localhost:8001` in your local browser.

### Option 3: Reverse Proxy (Production)

For a facility deployment with HTTPS, put CryoProcess behind Nginx:

```nginx
server {
    listen 443 ssl;
    server_name cryoprocess.facility.edu;

    ssl_certificate     /etc/ssl/certs/facility.pem;
    ssl_certificate_key /etc/ssl/private/facility.key;

    location / {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

The `Upgrade` and `Connection` headers are required for WebSocket support (real-time job status updates).

---

## Troubleshooting

### MongoDB Not Running

```bash
# Check status
sudo systemctl status mongod

# Start it
sudo systemctl start mongod

# Enable on boot
sudo systemctl enable mongod

# Check logs if it fails to start
sudo journalctl -u mongod --no-pager -n 50
```

### Port Already in Use

```bash
# See what's using port 8001
lsof -i :8001

# Kill it and restart
fuser -k 8001/tcp
./cryoprocess.sh start
```

### Server Starts But Dashboard Shows No Data

- Check that `ROOT_PATH` in `backend/.env` points to a valid directory
- Check that RELION output files exist in the project directory
- Check server logs: `./cryoprocess.sh logs`

### SLURM Jobs Fail to Submit

```bash
# Verify SLURM is accessible
sinfo
squeue

# Check that the partition exists
sinfo -p batch

# Test a simple job
sbatch --wrap="hostname" -p batch
```

If `sinfo` works from the command line but CryoProcess can't submit, check:
- The user running CryoProcess has SLURM access
- `SLURM_PARTITION` in `.env` matches an existing partition name

### MongoDB Disk Space

MongoDB stores only metadata (job parameters, status, cached results). Actual cryo-EM data stays on the filesystem. A project with 1,000 jobs uses roughly 50-100 MB of MongoDB storage.

```bash
# Check database size
mongosh --eval "use cryoprocess-db; db.stats()"
```

### Checking Application Health

```bash
# Full status check
./cryoprocess.sh status

# API health endpoint
curl http://localhost:8001/api/health
```

---

## Updating CryoProcess

```bash
./cryoprocess.sh stop
git pull
./cryoprocess.sh install
./cryoprocess.sh start
```

The install command will skip steps that are already done (existing `.env` is preserved, admin user is not recreated).

---

## Uninstalling

```bash
# Stop the server
./cryoprocess.sh stop

# Remove the application
cd ..
rm -rf cryoprocess

# Optionally remove the database
mongosh --eval "use cryoprocess-db; db.dropDatabase()"

# Optionally remove MongoDB (if no other apps use it)
sudo systemctl stop mongod
sudo apt remove mongodb-org   # Ubuntu/Debian
sudo yum remove mongodb-org   # CentOS/RHEL
```

Your cryo-EM data files are never modified or deleted by CryoProcess. They remain in `ROOT_PATH`.
