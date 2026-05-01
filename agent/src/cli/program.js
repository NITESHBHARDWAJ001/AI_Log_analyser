'use strict';

const { Command } = require('commander');
const pkg = require('../../package.json');

const program = new Command();

program
  .name('autoqual')
  .description('AutoQual AI+ CLI — Code-Aware Quality Intelligence Platform')
  .version(pkg.version);

program
  .command('init')
  .description('Interactive setup wizard — creates .autoqual.json')
  .action(require('./commands/init'));

program
  .command('connect')
  .description('Test connection to the AutoQual backend')
  .action(require('./commands/connect'));

program
  .command('status')
  .description('Show project status and recent activity')
  .action(require('./commands/status'));

program
  .command('send-test')
  .description('Send a test log to verify the pipeline')
  .action(require('./commands/sendTest'));

module.exports = { program };
