#!/bin/bash
# Persistent Next.js dev server — auto-restarts if killed by sandbox cleanup
cd /home/z/my-project
LOG=/tmp/next-dev.log
PIDFILE=/tmp/next-dev.pid

# Kill any stale instance
if [ -f "$PIDFILE" ]; then
  OLDPID=$(cat "$PIDFILE")
  if kill -0 "$OLDPID" 2>/dev/null; then
    kill -9 "$OLDPID" 2>/dev/null
  fi
fi
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 1

# Start in background, fully detached
nohup setsid bash -c '
  cd /home/z/my-project
  while true; do
    npx next dev -p 3000 >> /tmp/next-dev.log 2>&1
    echo "[$(date)] next dev exited, restarting in 2s..." >> /tmp/next-dev.log
    sleep 2
  done
' </dev/null >/dev/null 2>&1 &
disown
echo $! > "$PIDFILE"
echo "Started dev server supervisor PID $(cat $PIDFILE)"
echo "Log: $LOG"
