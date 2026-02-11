#!/bin/bash
#
# CryoProcess - Control Script
# Author: Karunakar Pothula
#
# Usage:
#   ./cryoprocess.sh prerequisites   - Install system dependencies
#   ./cryoprocess.sh install         - Setup application
#   ./cryoprocess.sh start           - Start services
#   ./cryoprocess.sh stop            - Stop services
#   ./cryoprocess.sh restart         - Restart services
#   ./cryoprocess.sh status          - Check status
#   ./cryoprocess.sh logs            - View logs
#

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Directories
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_DIR="$SCRIPT_DIR/pids"
LOG_DIR="$SCRIPT_DIR/logs"

# Create directories
mkdir -p "$PID_DIR" "$LOG_DIR"

# Files
PID_FILE="$PID_DIR/nodejs.pid"
LOG_FILE="$LOG_DIR/nodejs.log"

# Default port
PORT=${PORT:-8001}

# ============================================================
# Helper Functions
# ============================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}==>${NC} $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    fi
    return 1
}

# ============================================================
# Detect Linux Distribution
# ============================================================

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$NAME
        OS_ID=$ID
        OS_VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS_NAME="Red Hat"
        OS_ID="rhel"
    elif [ -f /etc/debian_version ]; then
        OS_NAME="Debian"
        OS_ID="debian"
    else
        OS_NAME="Unknown"
        OS_ID="unknown"
    fi

    echo -e "${CYAN}"
    echo "=============================================="
    echo "  CryoProcess - System Detection"
    echo "=============================================="
    echo -e "${NC}"
    echo "  OS:       $OS_NAME"
    echo "  Version:  $OS_VERSION"
    echo "  Arch:     $(uname -m)"
    echo "  Kernel:   $(uname -r)"
    echo ""
}

# ============================================================
# Prerequisites Command
# ============================================================

do_prerequisites() {
    detect_os

    echo -e "${CYAN}"
    echo "=============================================="
    echo "  Installing Prerequisites"
    echo "=============================================="
    echo -e "${NC}"

    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        SUDO="sudo"
        log_info "Will use sudo for package installation"
    else
        SUDO=""
    fi

    case "$OS_ID" in
        ubuntu|debian|linuxmint|pop)
            log_step "Detected Debian/Ubuntu based system"
            echo ""

            log_step "Updating package lists..."
            $SUDO apt-get update -qq

            log_step "Installing build tools..."
            $SUDO apt-get install -y git curl wget build-essential lsb-release gnupg

            log_step "Installing Node.js 20+..."
            if ! check_command node; then
                curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
                $SUDO apt-get install -y nodejs
            else
                log_info "Node.js already installed: $(node --version)"
            fi

            log_step "Installing MongoDB..."
            if ! check_command mongod; then
                UBUNTU_CODENAME=$(lsb_release -cs)
                case "$UBUNTU_CODENAME" in
                    noble|jammy|focal)
                        MONGO_CODENAME="$UBUNTU_CODENAME"
                        ;;
                    *)
                        MONGO_CODENAME="jammy"
                        ;;
                esac

                curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
                    $SUDO gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg 2>/dev/null || true

                echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${MONGO_CODENAME}/mongodb-org/8.0 multiverse" | \
                    $SUDO tee /etc/apt/sources.list.d/mongodb-org-8.0.list > /dev/null

                $SUDO apt-get update -qq
                $SUDO apt-get install -y mongodb-org

                $SUDO systemctl start mongod
                $SUDO systemctl enable mongod
            else
                log_info "MongoDB already installed"
            fi
            ;;

        centos|rhel|fedora|rocky|almalinux)
            log_step "Detected RHEL/CentOS based system"
            echo ""

            if check_command dnf; then
                PKG_MGR="dnf"
            else
                PKG_MGR="yum"
            fi

            log_step "Installing build tools..."
            $SUDO $PKG_MGR groupinstall -y "Development Tools"
            $SUDO $PKG_MGR install -y git curl wget

            log_step "Installing Node.js 20+..."
            if ! check_command node; then
                curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
                $SUDO $PKG_MGR install -y nodejs
            else
                log_info "Node.js already installed: $(node --version)"
            fi

            log_step "Installing MongoDB..."
            if ! check_command mongod; then
                cat <<EOF | $SUDO tee /etc/yum.repos.d/mongodb-org-8.0.repo
[mongodb-org-8.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/8.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-8.0.asc
EOF
                $SUDO $PKG_MGR install -y mongodb-org
                $SUDO systemctl start mongod
                $SUDO systemctl enable mongod
            else
                log_info "MongoDB already installed"
            fi
            ;;

        *)
            log_warn "Unknown distribution: $OS_ID"
            log_warn "Please install manually: Node.js 20+, MongoDB 8.0+"
            ;;
    esac

    echo ""
    log_step "Verifying installations..."
    echo ""

    # Verify Node.js
    if check_command node; then
        NODE_VER=$(node --version 2>&1)
        echo -e "  Node.js:  ${GREEN}OK${NC} $NODE_VER"
    else
        echo -e "  Node.js:  ${RED}MISSING${NC}"
    fi

    # Verify npm
    if check_command npm; then
        NPM_VER=$(npm --version 2>&1)
        echo -e "  npm:      ${GREEN}OK${NC} v$NPM_VER"
    else
        echo -e "  npm:      ${RED}MISSING${NC}"
    fi

    # Verify MongoDB
    if check_command mongod || check_command mongosh; then
        echo -e "  MongoDB:  ${GREEN}OK${NC} Installed"
        if systemctl is-active --quiet mongod 2>/dev/null; then
            echo -e "            ${GREEN}OK${NC} Running"
        else
            echo -e "            ${YELLOW}!${NC} Not running (start with: sudo systemctl start mongod)"
        fi
    else
        echo -e "  MongoDB:  ${RED}MISSING${NC}"
    fi

    echo ""
    echo -e "${GREEN}Prerequisites complete!${NC}"
    echo ""
    echo "Next step: ./cryoprocess.sh install"
    echo ""
}

# ============================================================
# Install Command
# ============================================================

do_install() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "  CryoProcess - Installation"
    echo "=============================================="
    echo -e "${NC}"

    # Check prerequisites
    log_step "Checking prerequisites..."

    local missing=0

    if ! check_command node; then
        log_error "Node.js is not installed"
        missing=1
    else
        NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VER" -lt 18 ]; then
            log_error "Node.js 18+ required. Current: $(node -v)"
            missing=1
        else
            log_info "Node.js: $(node --version)"
        fi
    fi

    if ! check_command npm; then
        log_error "npm is not installed"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        echo ""
        log_error "Missing prerequisites. Run: ./cryoprocess.sh prerequisites"
        exit 1
    fi

    echo ""

    # Setup .env in project root (single config file for everything)
    log_step "Configuring environment..."

    ENV_FILE="$SCRIPT_DIR/.env"

    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
            log_info "Created .env from template"
        else
            log_error ".env.example not found!"
            exit 1
        fi

        # Generate JWT secret
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
        log_info "Generated secure JWT secret"

        # Prompt for paths
        echo ""
        log_step "Configure required paths:"
        echo ""

        read -p "  Data root path (where cryo-EM projects are stored): " DATA_PATH
        if [ -n "$DATA_PATH" ]; then
            sed -i "s|ROOT_PATH=.*|ROOT_PATH=$DATA_PATH|" "$ENV_FILE"
        fi

        read -p "  RELION container path (.sif file, or leave empty): " RELION_PATH
        if [ -n "$RELION_PATH" ]; then
            sed -i "s|RELION_PATH=.*|RELION_PATH=$RELION_PATH|" "$ENV_FILE"
        fi

        # Build SINGULARITY_BIND_PATHS from the paths entered
        BIND_PATHS=""
        if [ -n "$DATA_PATH" ]; then
            BIND_PATHS="$DATA_PATH:$DATA_PATH"
        fi
        if [ -n "$RELION_PATH" ]; then
            RELION_DIR=$(dirname "$RELION_PATH")
            if [ -n "$BIND_PATHS" ]; then
                # Only add if different from data path
                if [ "$RELION_DIR" != "$DATA_PATH" ]; then
                    BIND_PATHS="$BIND_PATHS,$RELION_DIR:$RELION_DIR"
                fi
            else
                BIND_PATHS="$RELION_DIR:$RELION_DIR"
            fi
        fi
        if [ -n "$BIND_PATHS" ]; then
            sed -i "s|SINGULARITY_BIND_PATHS=.*|SINGULARITY_BIND_PATHS=$BIND_PATHS|" "$ENV_FILE"
        fi

        echo ""
        log_info "Configuration saved to .env"
    else
        log_info ".env already exists"
    fi

    # Remove legacy backend/.env if it exists (consolidated to root)
    if [ -f "$BACKEND_DIR/.env" ]; then
        log_info "Removing legacy backend/.env (settings now in root .env)"
        rm -f "$BACKEND_DIR/.env"
    fi

    echo ""

    # Install backend dependencies
    log_step "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    npm install --silent 2>/dev/null || npm install
    cd "$SCRIPT_DIR"
    log_info "Backend dependencies installed"

    echo ""

    # Install frontend dependencies
    log_step "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install --silent 2>/dev/null || npm install
    cd "$SCRIPT_DIR"
    log_info "Frontend dependencies installed"

    echo ""

    # Build frontend
    log_step "Building frontend for production..."
    cd "$FRONTEND_DIR"
    npm run build --silent 2>/dev/null || npm run build
    cd "$SCRIPT_DIR"

    # Copy build to backend
    rm -rf "$BACKEND_DIR/static"
    cp -r "$FRONTEND_DIR/build" "$BACKEND_DIR/static"
    log_info "Frontend built and deployed to backend/static"

    echo ""

    # Create admin user
    log_step "Setting up database..."

    # Create admin user using the dedicated utility script
    timeout 15 node "$BACKEND_DIR/src/utils/createAdmin.js" || log_warn "Could not create admin user. Make sure MongoDB is running."

    echo ""
    echo -e "${GREEN}"
    echo "=============================================="
    echo "  Installation Complete!"
    echo "=============================================="
    echo -e "${NC}"
    echo ""
    echo "  Default Admin Credentials:"
    echo "  --------------------------"
    echo "  Email:    admin@example.com"
    echo "  Password: admin123"
    echo ""
    echo "  ** Change password after first login! **"
    echo ""
    echo "=============================================="
    echo ""
    echo "Next step: ./cryoprocess.sh start"
    echo ""
}

# ============================================================
# Start Command
# ============================================================

do_start() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "  Starting CryoProcess"
    echo "=============================================="
    echo -e "${NC}"

    # Check if .env exists
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        log_error ".env not found!"
        log_error "Run: ./cryoprocess.sh install"
        exit 1
    fi

    # Check if already running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            log_warn "CryoProcess is already running (PID: $PID)"
            echo ""
            echo "  URL: http://localhost:$PORT"
            echo ""
            echo "  Stop with: ./cryoprocess.sh stop"
            exit 0
        fi
    fi

    # Kill any existing processes on port
    fuser -k $PORT/tcp 2>/dev/null || true
    pkill -f "node src/server.js" 2>/dev/null || true
    sleep 1

    # Start Node.js server
    log_step "Starting server on port $PORT..."

    cd "$BACKEND_DIR"
    NODE_ENV=production nohup node src/server.js > "$LOG_FILE" 2>&1 &
    NODE_PID=$!
    echo $NODE_PID > "$PID_FILE"
    cd "$SCRIPT_DIR"

    # Wait for server to start
    for i in {1..15}; do
        if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # Check if started
    if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}"
        echo "=============================================="
        echo "  CryoProcess is running!"
        echo "=============================================="
        echo -e "${NC}"
        echo ""
        echo "  URL:      http://localhost:$PORT"
        echo "  Login:    admin@example.com / admin123"
        echo ""
        echo "  Commands:"
        echo "    ./cryoprocess.sh status   - Check status"
        echo "    ./cryoprocess.sh logs     - View logs"
        echo "    ./cryoprocess.sh stop     - Stop server"
        echo ""
    else
        log_error "Failed to start. Check logs:"
        echo ""
        tail -20 "$LOG_FILE"
        exit 1
    fi
}

# ============================================================
# Stop Command
# ============================================================

do_stop() {
    log_info "Stopping CryoProcess..."

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID 2>/dev/null || true
            sleep 2
            if ps -p $PID > /dev/null 2>&1; then
                kill -9 $PID 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"
    fi

    # Kill any remaining processes
    fuser -k $PORT/tcp 2>/dev/null || true
    pkill -f "node src/server.js" 2>/dev/null || true

    log_info "CryoProcess stopped"
}

# ============================================================
# Status Command
# ============================================================

do_status() {
    echo ""
    echo "CryoProcess Status"
    echo "=========================="
    echo ""

    # Node.js server
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "  Server:    ${GREEN}Running${NC} (PID: $PID)"
            echo -e "  URL:       http://localhost:$PORT"

            # Check health
            if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
                echo -e "  Health:    ${GREEN}OK${NC}"
            else
                echo -e "  Health:    ${YELLOW}Not responding${NC}"
            fi
        else
            echo -e "  Server:    ${RED}Stopped${NC} (stale PID file)"
        fi
    else
        if lsof -i :$PORT > /dev/null 2>&1; then
            echo -e "  Server:    ${YELLOW}Running${NC} (no PID file)"
        else
            echo -e "  Server:    ${RED}Stopped${NC}"
        fi
    fi

    # MongoDB
    if pgrep -x mongod > /dev/null 2>&1; then
        echo -e "  MongoDB:   ${GREEN}Running${NC}"
    elif systemctl is-active --quiet mongod 2>/dev/null; then
        echo -e "  MongoDB:   ${GREEN}Running${NC}"
    else
        echo -e "  MongoDB:   ${YELLOW}Not detected${NC}"
    fi

    echo ""
}

# ============================================================
# Logs Command
# ============================================================

do_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo "Showing logs (Ctrl+C to exit)..."
        echo ""
        tail -f "$LOG_FILE"
    else
        log_error "No log file found at $LOG_FILE"
    fi
}

# ============================================================
# Build Command
# ============================================================

do_build() {
    log_step "Rebuilding frontend..."

    cd "$FRONTEND_DIR"
    npm run build
    cd "$SCRIPT_DIR"

    rm -rf "$BACKEND_DIR/static"
    cp -r "$FRONTEND_DIR/build" "$BACKEND_DIR/static"

    log_info "Frontend rebuilt and deployed"
}

# ============================================================
# Dev Command (development mode)
# ============================================================

do_dev() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "  Starting Development Mode"
    echo "=============================================="
    echo -e "${NC}"

    log_info "Starting backend with auto-reload..."
    cd "$BACKEND_DIR"
    npm run dev
}

# ============================================================
# Help
# ============================================================

show_help() {
    echo ""
    echo -e "${CYAN}CryoProcess - Control Script${NC}"
    echo ""
    echo "Usage: ./cryoprocess.sh <command>"
    echo ""
    echo "Commands:"
    echo "  prerequisites  Install system dependencies (Node.js, MongoDB)"
    echo "  install        Setup application (install packages, build frontend)"
    echo "  start          Start production server (port $PORT)"
    echo "  stop           Stop server"
    echo "  restart        Restart server"
    echo "  status         Show server status"
    echo "  logs           View server logs (Ctrl+C to exit)"
    echo "  build          Rebuild frontend"
    echo "  dev            Start in development mode (with auto-reload)"
    echo "  help           Show this help"
    echo ""
    echo "Quick Start:"
    echo "  1. ./cryoprocess.sh prerequisites"
    echo "  2. ./cryoprocess.sh install"
    echo "  3. ./cryoprocess.sh start"
    echo ""
    echo "Development:"
    echo "  ./cryoprocess.sh dev     # Backend with auto-reload"
    echo "  cd frontend && npm start      # Frontend dev server"
    echo ""
}

# ============================================================
# Main
# ============================================================

case "${1:-help}" in
    prerequisites|prereq|deps)
        do_prerequisites
        ;;
    install|setup)
        do_install
        ;;
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_stop
        sleep 2
        do_start
        ;;
    status)
        do_status
        ;;
    logs|log)
        do_logs
        ;;
    build)
        do_build
        ;;
    dev|development)
        do_dev
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
