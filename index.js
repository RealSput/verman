#!/usr/bin/env node
const { Command } = require('commander');
const repl = require('./lib');
const program = new Command();

program
  .name('verman')
  .description('A CLI tool to manage versions of folders.')
  .version('1.0.0');

program.command('manage')
  .description('Manage a version of a folder')
  .argument('<folder>', 'path to folder')
  .action((path) => {
    repl.sdir(path);
    repl.start();
  });

program.parse();