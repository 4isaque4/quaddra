module.exports = {
  apps: [
    {
      name: 'quaddra-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/quaddra/apps/web',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/quaddra-web-error.log',
      out_file: '/var/log/pm2/quaddra-web-out.log',
      time: true,
    },
  ],
};
