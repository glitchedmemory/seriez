module.exports = {
  apps: [{
    name: "seriez",
    script: "node_modules/.bin/next",
    args: "start -p 3000",
    cwd: "/root/seriez",
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    max_restarts: 5,
    restart_delay: 5000,
    wait_ready: true,
    listen_timeout: 30000,
    kill_timeout: 10000,
    max_memory_restart: "1600M",
    env: {
      NODE_ENV: "production",
      NODE_OPTIONS: "--max-old-space-size=1408",
    },
    error_file: "/root/seriez/logs/err.log",
    out_file: "/root/seriez/logs/out.log",
    merge_logs: true,
  }]
};
