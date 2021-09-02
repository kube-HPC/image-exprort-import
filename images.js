const coreImages = [
    // {
    //     image:{
    //         repository:'hkube/python-env',
    //         tag:'1.1.88'
    //     },
    //     name: 'python-env'
    // },
    // {
    //     image:{
    //         repository:'hkube/nodejs-env',
    //         tag:'1.1.84'
    //     },
    //     name: 'nodejs-env'
    // },
    {
        image: {
            repository: 'hkube/base-node',
            tag: 'v1.2.0'
        },
        name: 'base-node',
    },
    {
        image: {
            repository: 'python',
            tag: '3.7'
        },
        name: 'python37'
    },
    {
        image: {
            repository: 'node',
            tag: '14.5.0-slim'
        },
        name: 'node14'
    },
    {
        image: {
            repository: 'node',
            tag: '14.5.0'
        },
        name: 'node14full'
    },
    {
        image: {
            repository: 'hkube/openjdk11',
            tag: 'jre-11.0.8_10-ubuntu'
        },
        name: 'java'
    },
    {
        image: {
            repository: 'maven',
            tag: '3.6.3-openjdk-11-slim'
        },
        name: 'maven'
    },
    {
        image: {
            repository: 'fluent/fluent-bit',
            tag: '1.8.3'
        },
        name: fluentbit
    }
]
module.exports = {
    coreImages
}