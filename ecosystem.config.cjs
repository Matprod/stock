module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'bin/server.js',
      cwd: './build',
    },
    {
      name: 'queue',
      script: 'ace.js',
      args: 'queue:work',
      cwd: './build',
      env: { PORT: 3334 },
    },
  ],
}
