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
        image:{
            repository:'hkube/base-node',
            tag:'v1.2.0'
        },
        name: 'base-node',
    },
    {
        image:{
            repository:'python',
            tag:'3.7'
        },
        name: 'python37'
    },
    {
        image:{
            repository:'node',
            tag:'14.5.0-slim'
        },
        name: 'node14'
    },
    {
        image:{
            repository:'adoptopenjdk/openjdk11',
            tag:'latest'
        },
        name: 'node14'
    }
]
module.exports={
    coreImages
}