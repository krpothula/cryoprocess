#!/bin/bash
#
# CryoProcess - Non-Root Installation Script
# Author: Karunakar Pothula
#
# Installs Node.js and MongoDB as local binaries (no root/sudo required).
# Optionally sets up systemd user services for auto-start on boot.
#
# Usage:
#   ./cryoprocess-user.sh install       - Download binaries + setup application
#   ./cryoprocess-user.sh start         - Start MongoDB + CryoProcess server
#   ./cryoprocess-user.sh stop          - Stop all services
#   ./cryoprocess-user.sh restart       - Restart all services
#   ./cryoprocess-user.sh status        - Check status
#   ./cryoprocess-user.sh logs          - View server logs
#   ./cryoprocess-user.sh enable-boot   - Enable auto-start on boot (systemd user service)
#   ./cryoprocess-user.sh disable-boot  - Disable auto-start on boot
#

set -e

# ============================================================
# Configuration
# ============================================================

NODE_VERSION="20.18.1"
MONGODB_VERSION="8.0.4"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Directories
LOCAL_DIR="$SCRIPT_DIR/local"
NODE_DIR="$LOCAL_DIR/node"
MONGO_DIR="$LOCAL_DIR/mongodb"
MONGO_DATA_DIR="$SCRIPT_DIR/data/mongodb"
MONGO_LOG_DIR="$SCRIPT_DIR/logs"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_DIR="$SCRIPT_DIR/pids"
LOG_DIR="$SCRIPT_DIR/logs"

# Create directories
mkdir -p "$LOCAL_DIR" "$PID_DIR" "$LOG_DIR" "$MONGO_DATA_DIR"

# Files
NODE_PID_FILE="$PID_DIR/nodejs.pid"
MONGO_PID_FILE="$PID_DIR/mongod.pid"
NODE_LOG_FILE="$LOG_DIR/nodejs.log"
MONGO_LOG_FILE="$LOG_DIR/mongod.log"
MONGO_CONF_FILE="$LOCAL_DIR/mongod.conf"

# Default port
PORT=${PORT:-8001}
MONGO_PORT=${MONGO_PORT:-27018}

# Set PATH to include local binaries
export PATH="$NODE_DIR/bin:$MONGO_DIR/bin:$PATH"

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
    command -v "$1" &> /dev/null
}

# Detect architecture
detect_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64)  echo "x64" ;;
        aarch64) echo "arm64" ;;
        *)
            log_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
}

# Detect OS for MongoDB download
detect_os_for_mongo() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu)
                case "$VERSION_ID" in
                    24.04) echo "ubuntu2404" ;;
                    22.04) echo "ubuntu2204" ;;
                    20.04) echo "ubuntu2004" ;;
                    *)     echo "ubuntu2204" ;;
                esac
                ;;
            debian)
                case "$VERSION_ID" in
                    12) echo "debian12" ;;
                    11) echo "debian11" ;;
                    *)  echo "debian12" ;;
                esac
                ;;
            rhel|centos|rocky|almalinux)
                echo "rhel90"
                ;;
            *)
                echo "ubuntu2204"
                ;;
        esac
    else
        echo "ubuntu2204"
    fi
}

# ============================================================
# Download & Install Binaries
# ============================================================

install_node() {
    if [ -f "$NODE_DIR/bin/node" ]; then
        local current_ver
        current_ver=$("$NODE_DIR/bin/node" --version 2>/dev/null | tr -d 'v')
        if [ "$current_ver" = "$NODE_VERSION" ]; then
            log_info "Node.js v$NODE_VERSION already installed locally"
            return 0
        fi
    fi

    local arch
    arch=$(detect_arch)

    log_step "Downloading Node.js v$NODE_VERSION ($arch)..."

    local url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.xz"
    local tmp_file="$LOCAL_DIR/node-v${NODE_VERSION}-linux-${arch}.tar.xz"

    curl -fSL --progress-bar "$url" -o "$tmp_file"

    log_step "Extracting Node.js..."
    rm -rf "$NODE_DIR"
    mkdir -p "$NODE_DIR"
    tar -xf "$tmp_file" -C "$NODE_DIR" --strip-components=1
    rm -f "$tmp_file"

    log_info "Node.js v$NODE_VERSION installed to $NODE_DIR"
    log_info "  node: $("$NODE_DIR/bin/node" --version)"
    log_info "  npm:  v$("$NODE_DIR/bin/npm" --version)"
}

install_mongodb() {
    if [ -f "$MONGO_DIR/bin/mongod" ]; then
        log_info "MongoDB already installed locally"
        return 0
    fi

    local arch
    arch=$(uname -m)
    local os_tag
    os_tag=$(detect_os_for_mongo)

    log_step "Downloading MongoDB v$MONGODB_VERSION ($os_tag, $arch)..."

    local url="https://fastdl.mongodb.org/linux/mongodb-linux-${arch}-${os_tag}-${MONGODB_VERSION}.tgz"
    local tmp_file="$LOCAL_DIR/mongodb-${MONGODB_VERSION}.tgz"

    curl -fSL --progress-bar "$url" -o "$tmp_file"

    log_step "Extracting MongoDB..."
    rm -rf "$MONGO_DIR"
    mkdir -p "$MONGO_DIR"
    tar -xzf "$tmp_file" -C "$MONGO_DIR" --strip-components=1
    rm -f "$tmp_file"

    # Also download mongosh (MongoDB Shell) separately
    install_mongosh

    # Create MongoDB config file
    create_mongo_config

    log_info "MongoDB v$MONGODB_VERSION installed to $MONGO_DIR"
}

install_mongosh() {
    if [ -f "$MONGO_DIR/bin/mongosh" ]; then
        return 0
    fi

    local arch
    arch=$(uname -m)

    log_step "Downloading MongoDB Shell (mongosh)..."

    local url="https://downloads.mongodb.com/compass/mongosh-2.3.8-linux-${arch}.tgz"
    local tmp_file="$LOCAL_DIR/mongosh.tgz"

    if curl -fSL --progress-bar "$url" -o "$tmp_file" 2>/dev/null; then
        local tmp_extract="$LOCAL_DIR/mongosh_tmp"
        mkdir -p "$tmp_extract"
        tar -xzf "$tmp_file" -C "$tmp_extract" --strip-components=1
        cp "$tmp_extract/bin/mongosh" "$MONGO_DIR/bin/" 2>/dev/null || true
        rm -rf "$tmp_extract" "$tmp_file"
        log_info "mongosh installed"
    else
        log_warn "Could not download mongosh (optional - MongoDB will still work)"
    fi
}

create_mongo_config() {
    cat > "$MONGO_CONF_FILE" <<EOF
# MongoDB Configuration (user-level instance)
storage:
  dbPath: $MONGO_DATA_DIR

systemLog:
  destination: file
  path: $MONGO_LOG_FILE
  logAppend: true

net:
  port: $MONGO_PORT
  bindIp: 127.0.0.1

processManagement:
  fork: true
  pidFilePath: $MONGO_PID_FILE
EOF
    log_info "MongoDB config written to $MONGO_CONF_FILE"
}

# ============================================================
# Install Application
# ============================================================

do_install() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "  CryoProcess - Non-Root Installation"
    echo "=============================================="
    echo -e "${NC}"
    echo "  No root/sudo required!"
    echo "  Binaries install to: $LOCAL_DIR"
    echo ""

    # Step 1: Download binaries
    log_step "Step 1: Installing local binaries..."
    echo ""
    install_node
    echo ""
    install_mongodb
    echo ""

    # Update PATH for this session
    export PATH="$NODE_DIR/bin:$MONGO_DIR/bin:$PATH"

    # Step 2: Verify
    log_step "Step 2: Verifying installations..."
    echo ""

    if [ -f "$NODE_DIR/bin/node" ]; then
        echo -e "  Node.js:  ${GREEN}OK${NC} $("$NODE_DIR/bin/node" --version)"
    else
        echo -e "  Node.js:  ${RED}FAILED${NC}"
        exit 1
    fi

    if [ -f "$NODE_DIR/bin/npm" ]; then
        echo -e "  npm:      ${GREEN}OK${NC} v$("$NODE_DIR/bin/npm" --version)"
    else
        echo -e "  npm:      ${RED}FAILED${NC}"
        exit 1
    fi

    if [ -f "$MONGO_DIR/bin/mongod" ]; then
        echo -e "  MongoDB:  ${GREEN}OK${NC} ($MONGO_DIR/bin/mongod)"
    else
        echo -e "  MongoDB:  ${RED}FAILED${NC}"
        exit 1
    fi
    echo ""

    # Step 3: Setup .env
    log_step "Step 3: Configuring environment..."

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
        JWT_SECRET=$("$NODE_DIR/bin/node" -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
        log_info "Generated secure JWT secret"

        # Set MongoDB URI to use local port
        sed -i "s|MONGODB_URI=.*|MONGODB_URI=mongodb://localhost:$MONGO_PORT/cryoprocess-db|" "$ENV_FILE"
        log_info "MongoDB URI set to port $MONGO_PORT"

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

        # Build SINGULARITY_BIND_PATHS
        BIND_PATHS=""
        if [ -n "$DATA_PATH" ]; then
            BIND_PATHS="$DATA_PATH:$DATA_PATH"
        fi
        if [ -n "$RELION_PATH" ]; then
            RELION_DIR=$(dirname "$RELION_PATH")
            if [ -n "$BIND_PATHS" ]; then
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

    # Remove legacy backend/.env if it exists
    if [ -f "$BACKEND_DIR/.env" ]; then
        log_info "Removing legacy backend/.env (settings now in root .env)"
        rm -f "$BACKEND_DIR/.env"
    fi

    echo ""

    # Step 4: Install backend dependencies
    log_step "Step 4: Installing backend dependencies..."
    cd "$BACKEND_DIR"
    "$NODE_DIR/bin/npm" install --silent 2>/dev/null || "$NODE_DIR/bin/npm" install
    cd "$SCRIPT_DIR"
    log_info "Backend dependencies installed"

    echo ""

    # Step 5: Install frontend dependencies
    log_step "Step 5: Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    "$NODE_DIR/bin/npm" install --silent 2>/dev/null || "$NODE_DIR/bin/npm" install
    cd "$SCRIPT_DIR"
    log_info "Frontend dependencies installed"

    echo ""

    # Step 6: Build frontend
    log_step "Step 6: Building frontend for production..."
    cd "$FRONTEND_DIR"
    "$NODE_DIR/bin/npm" run build --silent 2>/dev/null || "$NODE_DIR/bin/npm" run build
    cd "$SCRIPT_DIR"

    rm -rf "$BACKEND_DIR/static"
    cp -r "$FRONTEND_DIR/build" "$BACKEND_DIR/static"
    log_info "Frontend built and deployed to backend/static"

    echo ""

    # Step 7: Start MongoDB and create admin user
    log_step "Step 7: Setting up database..."

    start_mongodb

    # Create admin user
    timeout 15 "$NODE_DIR/bin/node" "$BACKEND_DIR/src/utils/createAdmin.js" || log_warn "Could not create admin user. Make sure MongoDB is running."

    echo ""
    echo -e "${GREEN}"
    echo "=============================================="
    echo "  Installation Complete! (No root used)"
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
    echo "  Binaries installed to:"
    echo "    Node.js:  $NODE_DIR"
    echo "    MongoDB:  $MONGO_DIR"
    echo "    DB data:  $MONGO_DATA_DIR"
    echo ""
    echo "=============================================="
    echo ""
    echo "Next step: ./cryoprocess-user.sh start"
    echo ""
    echo "Optional: ./cryoprocess-user.sh enable-boot"
    echo "  (auto-start on system boot via systemd user service)"
    echo ""
}

# ============================================================
# MongoDB Management
# ============================================================

start_mongodb() {
    # Check if already running
    if [ -f "$MONGO_PID_FILE" ]; then
        local pid
        pid=$(cat "$MONGO_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_info "MongoDB already running (PID: $pid, port $MONGO_PORT)"
            return 0
        fi
        rm -f "$MONGO_PID_FILE"
    fi

    # Check if local mongod binary exists
    if [ ! -f "$MONGO_DIR/bin/mongod" ]; then
        log_error "Local MongoDB binary not found. Run: ./cryoprocess-user.sh install"
        return 1
    fi

    # Ensure config exists
    if [ ! -f "$MONGO_CONF_FILE" ]; then
        create_mongo_config
    fi

    log_step "Starting MongoDB on port $MONGO_PORT..."
    "$MONGO_DIR/bin/mongod" --config "$MONGO_CONF_FILE"

    # Wait for MongoDB to start
    for i in {1..10}; do
        if "$MONGO_DIR/bin/mongosh" --port "$MONGO_PORT" --eval "db.runCommand({ping:1})" > /dev/null 2>&1; then
            log_info "MongoDB started (PID: $(cat "$MONGO_PID_FILE" 2>/dev/null))"
            return 0
        fi
        sleep 1
    done

    log_warn "MongoDB may not have started correctly. Check: $MONGO_LOG_FILE"
}

stop_mongodb() {
    if [ -f "$MONGO_PID_FILE" ]; then
        local pid
        pid=$(cat "$MONGO_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_info "Stopping MongoDB (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            # Wait for graceful shutdown
            for i in {1..10}; do
                if ! ps -p "$pid" > /dev/null 2>&1; then
                    break
                fi
                sleep 1
            done
            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$MONGO_PID_FILE"
        log_info "MongoDB stopped"
    else
        log_info "MongoDB not running (no PID file)"
    fi
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
        log_error ".env not found! Run: ./cryoprocess-user.sh install"
        exit 1
    fi

    # Check if local node exists
    if [ ! -f "$NODE_DIR/bin/node" ]; then
        log_error "Local Node.js not found. Run: ./cryoprocess-user.sh install"
        exit 1
    fi

    # Start MongoDB first
    start_mongodb
    echo ""

    # Check if server already running
    if [ -f "$NODE_PID_FILE" ]; then
        local pid
        pid=$(cat "$NODE_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_warn "CryoProcess is already running (PID: $pid)"
            echo ""
            echo "  URL: http://localhost:$PORT"
            echo "  Stop with: ./cryoprocess-user.sh stop"
            exit 0
        fi
    fi

    # Kill any existing processes on port
    fuser -k "$PORT/tcp" 2>/dev/null || true
    sleep 1

    # Start Node.js server
    log_step "Starting server on port $PORT..."

    cd "$BACKEND_DIR"
    NODE_ENV=production nohup "$NODE_DIR/bin/node" src/server.js > "$NODE_LOG_FILE" 2>&1 &
    local node_pid=$!
    echo "$node_pid" > "$NODE_PID_FILE"
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
        echo "    ./cryoprocess-user.sh status   - Check status"
        echo "    ./cryoprocess-user.sh logs     - View logs"
        echo "    ./cryoprocess-user.sh stop     - Stop server"
        echo ""
    else
        log_error "Failed to start. Check logs:"
        echo ""
        tail -20 "$NODE_LOG_FILE"
        exit 1
    fi
}

# ============================================================
# Stop Command
# ============================================================

do_stop() {
    log_info "Stopping CryoProcess..."

    # Stop Node.js server
    if [ -f "$NODE_PID_FILE" ]; then
        local pid
        pid=$(cat "$NODE_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            kill "$pid" 2>/dev/null || true
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$NODE_PID_FILE"
    fi

    fuser -k "$PORT/tcp" 2>/dev/null || true

    log_info "CryoProcess server stopped"

    # Stop MongoDB
    stop_mongodb
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
    if [ -f "$NODE_PID_FILE" ]; then
        local pid
        pid=$(cat "$NODE_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "  Server:    ${GREEN}Running${NC} (PID: $pid)"
            echo -e "  URL:       http://localhost:$PORT"

            if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
                echo -e "  Health:    ${GREEN}OK${NC}"
            else
                echo -e "  Health:    ${YELLOW}Not responding${NC}"
            fi
        else
            echo -e "  Server:    ${RED}Stopped${NC} (stale PID file)"
        fi
    else
        echo -e "  Server:    ${RED}Stopped${NC}"
    fi

    # MongoDB
    if [ -f "$MONGO_PID_FILE" ]; then
        local pid
        pid=$(cat "$MONGO_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "  MongoDB:   ${GREEN}Running${NC} (PID: $pid, port $MONGO_PORT)"
        else
            echo -e "  MongoDB:   ${RED}Stopped${NC} (stale PID file)"
        fi
    elif pgrep -x mongod > /dev/null 2>&1; then
        echo -e "  MongoDB:   ${GREEN}Running${NC} (system service)"
    else
        echo -e "  MongoDB:   ${RED}Stopped${NC}"
    fi

    # Binaries
    echo ""
    echo "  Binaries:"
    if [ -f "$NODE_DIR/bin/node" ]; then
        echo -e "    Node.js: ${GREEN}$("$NODE_DIR/bin/node" --version)${NC} ($NODE_DIR)"
    else
        echo -e "    Node.js: ${RED}Not installed${NC}"
    fi
    if [ -f "$MONGO_DIR/bin/mongod" ]; then
        echo -e "    MongoDB: ${GREEN}Installed${NC} ($MONGO_DIR)"
    else
        echo -e "    MongoDB: ${RED}Not installed${NC}"
    fi

    # Boot service status
    if systemctl --user is-enabled cryoprocess.service > /dev/null 2>&1; then
        echo ""
        echo -e "  Auto-start on boot: ${GREEN}Enabled${NC}"
    fi

    echo ""
}

# ============================================================
# Logs Command
# ============================================================

do_logs() {
    if [ -f "$NODE_LOG_FILE" ]; then
        echo "Showing server logs (Ctrl+C to exit)..."
        echo ""
        tail -f "$NODE_LOG_FILE"
    else
        log_error "No log file found at $NODE_LOG_FILE"
    fi
}

# ============================================================
# Build Command
# ============================================================

do_build() {
    log_step "Rebuilding frontend..."

    cd "$FRONTEND_DIR"
    "$NODE_DIR/bin/npm" run build
    cd "$SCRIPT_DIR"

    rm -rf "$BACKEND_DIR/static"
    cp -r "$FRONTEND_DIR/build" "$BACKEND_DIR/static"

    log_info "Frontend rebuilt and deployed"
}

# ============================================================
# Dev Command
# ============================================================

do_dev() {
    echo -e "${CYAN}"
    echo "=============================================="
    echo "  Starting Development Mode"
    echo "=============================================="
    echo -e "${NC}"

    # Start MongoDB if not running
    start_mongodb
    echo ""

    log_info "Starting backend with auto-reload..."
    cd "$BACKEND_DIR"
    "$NODE_DIR/bin/npm" run dev
}

# ============================================================
# Systemd User Service (auto-start on boot, no root)
# ============================================================

do_enable_boot() {
    local service_dir="$HOME/.config/systemd/user"
    mkdir -p "$service_dir"

    # MongoDB service
    cat > "$service_dir/cryoprocess-mongodb.service" <<EOF
[Unit]
Description=CryoProcess MongoDB (user-level)

[Service]
Type=forking
PIDFile=$MONGO_PID_FILE
ExecStart=$MONGO_DIR/bin/mongod --config $MONGO_CONF_FILE
ExecStop=/bin/kill -TERM \$MAINPID
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

    # CryoProcess server service
    cat > "$service_dir/cryoprocess.service" <<EOF
[Unit]
Description=CryoProcess Server
After=cryoprocess-mongodb.service
Requires=cryoprocess-mongodb.service

[Service]
Type=simple
WorkingDirectory=$BACKEND_DIR
Environment=NODE_ENV=production
Environment=PATH=$NODE_DIR/bin:$MONGO_DIR/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$NODE_DIR/bin/node src/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

    # Reload and enable
    systemctl --user daemon-reload
    systemctl --user enable cryoprocess-mongodb.service
    systemctl --user enable cryoprocess.service

    # Enable lingering (allows user services to run after logout)
    if check_command loginctl; then
        loginctl enable-linger "$(whoami)" 2>/dev/null || \
            log_warn "Could not enable lingering. Ask admin to run: sudo loginctl enable-linger $(whoami)"
    fi

    echo ""
    log_info "Systemd user services enabled!"
    echo ""
    echo "  Services will auto-start on boot."
    echo "  They run as your user ($(whoami)) - no root required."
    echo ""
    echo "  You can also manage them with:"
    echo "    systemctl --user start cryoprocess"
    echo "    systemctl --user stop cryoprocess"
    echo "    systemctl --user status cryoprocess"
    echo ""
    echo "  Note: For services to run after you log out,"
    echo "  'loginctl enable-linger' must be set (attempted above)."
    echo ""
}

do_disable_boot() {
    systemctl --user stop cryoprocess.service 2>/dev/null || true
    systemctl --user stop cryoprocess-mongodb.service 2>/dev/null || true
    systemctl --user disable cryoprocess.service 2>/dev/null || true
    systemctl --user disable cryoprocess-mongodb.service 2>/dev/null || true
    systemctl --user daemon-reload

    log_info "Auto-start on boot disabled"
}

# ============================================================
# Uninstall local binaries
# ============================================================

do_uninstall() {
    echo ""
    read -p "This will remove local Node.js and MongoDB binaries. Continue? (y/N) " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Cancelled."
        return
    fi

    do_stop 2>/dev/null || true
    do_disable_boot 2>/dev/null || true

    rm -rf "$LOCAL_DIR"
    rm -rf "$MONGO_DATA_DIR"
    rm -f "$HOME/.config/systemd/user/cryoprocess.service"
    rm -f "$HOME/.config/systemd/user/cryoprocess-mongodb.service"

    log_info "Local binaries and MongoDB data removed"
    log_info "Application code and .env kept intact"
}

# ============================================================
# Help
# ============================================================

show_help() {
    echo ""
    echo -e "${CYAN}CryoProcess - Non-Root Installation${NC}"
    echo ""
    echo "Usage: ./cryoprocess-user.sh <command>"
    echo ""
    echo "Commands:"
    echo "  install        Download Node.js + MongoDB binaries and setup app (no root)"
    echo "  start          Start MongoDB + CryoProcess server"
    echo "  stop           Stop all services"
    echo "  restart        Restart all services"
    echo "  status         Show service status"
    echo "  logs           View server logs (Ctrl+C to exit)"
    echo "  build          Rebuild frontend"
    echo "  dev            Start in development mode"
    echo "  enable-boot    Auto-start on boot (systemd user service, no root)"
    echo "  disable-boot   Remove auto-start on boot"
    echo "  uninstall      Remove local binaries and data"
    echo "  help           Show this help"
    echo ""
    echo "Quick Start (no root required):"
    echo "  1. ./cryoprocess-user.sh install"
    echo "  2. ./cryoprocess-user.sh start"
    echo ""
    echo "Optional:"
    echo "  3. ./cryoprocess-user.sh enable-boot   # auto-start on reboot"
    echo ""
}

# ============================================================
# Main
# ============================================================

case "${1:-help}" in
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
    enable-boot)
        do_enable_boot
        ;;
    disable-boot)
        do_disable_boot
        ;;
    uninstall)
        do_uninstall
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
