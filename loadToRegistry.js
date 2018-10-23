const fs = require('fs');
const { Docker } = require('docker-cli-js');
const docker = new Docker();
const _path = '/home/matyz/Documents/dockers/test';

const registry = 'bla'
const getFilesFromFolder = path => {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, items) => {
            console.log(items);
            resolve(items);
        })
    });
}

const loadToRegistry = async (path,registry) => {
    console.log('##############33 path',path);
    const items = await getFilesFromFolder(path) 
    if(items){
        items.forEach(async item => {
            try {
                const loadData = await docker.command(`load -i ${path}/${item}`);
                const image = loadData.raw.split('Loaded image: ')[1].split('\n')[0]
                const res = await docker.command(`tag ${image} ${registry}/${image}`)
                console.log(res);
    
            } catch (error) {
                console.log(`error in ${image}: ${error}`)
            }
        })
    }
    else {
        console.log('couldnt find conatainers for loading');
    }
}






module.exports = {
    loadToRegistry
};











