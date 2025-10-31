#!/bin/bash

echo "Stopping existing MCP servers..."

kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port)
  if [ -n "$pid" ]; then
    echo "  Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
  fi
}

kill_port 7001
kill_port 7002

echo "Done."

