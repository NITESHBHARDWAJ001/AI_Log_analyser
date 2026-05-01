#!/usr/bin/env node
'use strict';

const path = require('path');
const { program } = require('../src/cli/program');

program.parse(process.argv);
