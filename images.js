const coreImages = [
    {
        image:{
            repository:'hkube/python-env',
            tag:'1.1.88'
        },
        name: 'python-env'
    },
    {
        image:{
            repository:'hkube/nodejs-env',
            tag:'1.1.84'
        },
        name: 'nodejs-env'
    },
    {
        image:{
            repository:'hkube/base-node',
            tag:'v1.1.1'
        },
        name: 'base-node'
    }
]
module.exports={
    coreImages
}