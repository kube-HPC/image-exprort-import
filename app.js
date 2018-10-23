#!/usr/bin/env node

const yargs = require('yargs')
const { loadToRegistry } = require('./loadToRegistry');
const { exportFromRegistry } = require('./exportFromRegistry')
const options = {
    loadDataToRegsitry: {
        path: {
            alias: 'p',
            default: '~/Download/repository'
        },
        registry: {
            alias: 'r',
            default: 'private.registry.rms'
        }
    },
    exportFromRegistry: {
        path: {
            alias: 'p',
            describe: 'path to write dockers'
        },
        semver: {
            alias: 'v',
            describe: 'provide a path to versions file'
        }
    }

}

yargs
    .command('load', 'load Data To Regsitry', options.loadDataToRegsitry,
        (argv) => loadToRegistry(argv.path, argv.registry))
    .command('export', 'exports containers to regsitry', options.exportFromRegistry,
        (argv) => exportFromRegistry(argv.path, argv.semver))
    .help().argv








