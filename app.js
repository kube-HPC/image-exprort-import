#!/usr/bin/env node

const yargs = require('yargs')
const { loadToRegistry } = require('./loadToRegistry');
const { exportFromRegistry, exportThirdparty } = require('./exportFromRegistry')
const options = {
    loadDataToRegsitry: {
        path: {
            alias: 'p',
            default: '~/Download/repository'
        },
        registry: {
            alias: 'r',
            default: ''
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
        },
        registry: {
            alias: 'r',
            default: ''
        }
    },
    exportThirdParty: {
        path: {
            describe: 'path to write dockers'
        },
        chartPath: {
            describe: 'provide a path to thirdparty chart path'
        },
        registry: {
            alias: 'r',
            default: ''
        },
        production: {
            default: true
        }
    }

}

yargs
    .command('load', 'load Data To Regsitry', options.loadDataToRegsitry,
        (argv) => loadToRegistry(argv.path, argv.registry))
    .command('exportThirdparty', 'exports thirdparty containers from regsitry', options.exportThirdParty,
        (argv) => exportThirdparty(argv.path, argv.chartPath, argv.registry, argv.production))
    .command('export', 'exports containers from regsitry', options.exportFromRegistry,
        (argv) => exportFromRegistry(argv.path, argv.semver, argv.registry))
    .help().argv








