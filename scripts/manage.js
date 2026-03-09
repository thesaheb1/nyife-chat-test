#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const COMPOSE_FILE = 'docker-compose.dev.yml';

const INFRA_SERVICES = ['mysql', 'redis', 'zookeeper', 'kafka'];
const BACKEND_SERVICES = [
  'api-gateway',
  'auth-service',
  'user-service',
  'subscription-service',
  'wallet-service',
  'contact-service',
  'template-service',
  'campaign-service',
  'chat-service',
  'whatsapp-service',
  'automation-service',
  'organization-service',
  'notification-service',
  'email-service',
  'support-service',
  'admin-service',
  'analytics-service',
  'media-service',
];

const MIGRATION_SERVICES = [
  'auth-service',
  'user-service',
  'subscription-service',
  'wallet-service',
  'contact-service',
  'whatsapp-service',
  'template-service',
  'campaign-service',
  'chat-service',
  'automation-service',
  'organization-service',
  'notification-service',
  'email-service',
  'support-service',
  'admin-service',
  'analytics-service',
  'media-service',
];
const ALL_COMPOSE_SERVICES = [...INFRA_SERVICES, ...BACKEND_SERVICES];
const KAFKA_TOPICS = [
  'campaign.execute',
  'campaign.status',
  'campaign.analytics',
  'notification.send',
  'email.send',
  'webhook.inbound',
  'wallet.transaction',
  'user.events',
];

function dockerCompose(args) {
  return runCommand('docker', ['compose', '-f', COMPOSE_FILE, ...args], ROOT_DIR);
}

function runNpxInService(service, args) {
  const serviceDir = path.join(ROOT_DIR, 'services', service);
  return runCommand(getNpxExecutable(), args, serviceDir);
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`Failed to run "${command} ${args.join(' ')}": ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

function getNpxExecutable() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function ensureComposeService(service) {
  if (!ALL_COMPOSE_SERVICES.includes(service)) {
    console.error(`Unknown compose service "${service}".`);
    console.error(`Allowed services: ${ALL_COMPOSE_SERVICES.join(', ')}`);
    process.exit(1);
  }
}

function ensureMigrationService(service) {
  if (!MIGRATION_SERVICES.includes(service)) {
    console.error(`Unknown migration service "${service}".`);
    console.error(`Allowed services: ${MIGRATION_SERVICES.join(', ')}`);
    process.exit(1);
  }
}

function hasMigrations(service) {
  const migrationDir = path.join(ROOT_DIR, 'services', service, 'src', 'migrations');
  return fs.existsSync(migrationDir) && fs.readdirSync(migrationDir).length > 0;
}

function printHelp() {
  console.log(`
Nyife Dev Operations

Stack commands:
  node scripts/manage.js stack up [--build]
  node scripts/manage.js stack stop
  node scripts/manage.js stack down [--volumes]
  node scripts/manage.js stack restart
  node scripts/manage.js stack ps
  node scripts/manage.js stack logs [service]

Infrastructure commands:
  node scripts/manage.js infra up
  node scripts/manage.js infra stop
  node scripts/manage.js infra down
  node scripts/manage.js infra restart

Single service commands:
  node scripts/manage.js service start <service>
  node scripts/manage.js service stop <service>
  node scripts/manage.js service restart <service>
  node scripts/manage.js service logs <service>

Migration commands:
  node scripts/manage.js migrate all
  node scripts/manage.js migrate service <service>
  node scripts/manage.js migrate undo <service>
  node scripts/manage.js migrate status <service>

Kafka commands:
  node scripts/manage.js kafka setup

Examples:
  docker compose -f ${COMPOSE_FILE} up -d --build
  npm run stack:up:build
  npm run service:restart -- auth-service
  npm run migrate -- auth-service
`);
}

function handleStackCommand(action, extraArgs) {
  switch (action) {
    case 'up': {
      const args = ['up', '-d'];
      if (extraArgs.includes('--build')) {
        args.push('--build');
      }
      dockerCompose(args);
      return;
    }
    case 'stop':
      dockerCompose(['stop']);
      return;
    case 'down': {
      const args = ['down'];
      if (extraArgs.includes('--volumes')) {
        args.push('--volumes');
      }
      dockerCompose(args);
      return;
    }
    case 'restart':
      dockerCompose(['restart']);
      return;
    case 'ps':
      dockerCompose(['ps']);
      return;
    case 'logs':
      if (extraArgs[0]) {
        ensureComposeService(extraArgs[0]);
        dockerCompose(['logs', '-f', extraArgs[0]]);
        return;
      }
      dockerCompose(['logs', '-f']);
      return;
    default:
      printHelp();
  }
}

function handleInfraCommand(action) {
  switch (action) {
    case 'up':
      dockerCompose(['up', '-d', ...INFRA_SERVICES]);
      return;
    case 'stop':
      dockerCompose(['stop', ...INFRA_SERVICES]);
      return;
    case 'down':
      dockerCompose(['rm', '-f', '-s', ...INFRA_SERVICES]);
      return;
    case 'restart':
      dockerCompose(['restart', ...INFRA_SERVICES]);
      return;
    default:
      printHelp();
  }
}

function handleServiceCommand(action, service) {
  if (!service) {
    console.error('A service name is required.');
    printHelp();
    process.exit(1);
  }

  ensureComposeService(service);

  switch (action) {
    case 'start':
      dockerCompose(['up', '-d', service]);
      return;
    case 'stop':
      dockerCompose(['stop', service]);
      return;
    case 'restart':
      dockerCompose(['restart', service]);
      return;
    case 'logs':
      dockerCompose(['logs', '-f', service]);
      return;
    default:
      printHelp();
  }
}

function runMigration(service, commandArgs) {
  ensureMigrationService(service);

  if (!hasMigrations(service)) {
    console.log(`[${service}] No migrations found. Skipping.`);
    return;
  }

  console.log(`\n[${service}] Running: npx ${commandArgs.join(' ')}`);
  runNpxInService(service, commandArgs);
}

function handleMigrationCommand(action, service) {
  switch (action) {
    case 'all':
      for (const migrationService of MIGRATION_SERVICES) {
        runMigration(migrationService, ['sequelize-cli', 'db:migrate']);
      }
      return;
    case 'service':
      runMigration(service, ['sequelize-cli', 'db:migrate']);
      return;
    case 'undo':
      runMigration(service, ['sequelize-cli', 'db:migrate:undo']);
      return;
    case 'status':
      runMigration(service, ['sequelize-cli', 'db:migrate:status']);
      return;
    default:
      printHelp();
  }
}

function handleKafkaCommand(action) {
  if (action !== 'setup') {
    printHelp();
    return;
  }

  const createCommands = KAFKA_TOPICS.map(
    (topic) =>
      `kafka-topics --create --bootstrap-server kafka:29092 --topic ${topic} --partitions 3 --replication-factor 1 --if-not-exists || true`
  ).join(' && ');

  const script = `${createCommands} && kafka-topics --list --bootstrap-server kafka:29092`;
  dockerCompose(['exec', '-T', 'kafka', 'bash', '-lc', script]);
}

const [group, action, ...extraArgs] = process.argv.slice(2);

if (!group || group === 'help' || group === '--help' || group === '-h') {
  printHelp();
  process.exit(0);
}

switch (group) {
  case 'stack':
    handleStackCommand(action, extraArgs);
    break;
  case 'infra':
    handleInfraCommand(action);
    break;
  case 'service':
    handleServiceCommand(action, extraArgs[0]);
    break;
  case 'migrate':
    handleMigrationCommand(action, extraArgs[0]);
    break;
  case 'kafka':
    handleKafkaCommand(action);
    break;
  default:
    printHelp();
    process.exit(1);
}
