export default {
  apps: [
    {
      name: "whatsapp-bot",
      script: "./cluster.js",
      exec_mode: "fork", // your cluster.js already does the clustering
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
