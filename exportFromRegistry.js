const fs = require('fs-extra');
const jsyaml = require('js-yaml');
const { Docker } = require('docker-cli-js');
const syncSpawn = require('./helpers/sync-spawn');
const docker = new Docker();
const _createImageName = ({ registry, namespace, repository, tag }, ignoreTag) => {
    let array = [registry, namespace, repository];
    array = array.filter(a => a);
    let image = array.join('/');
    if (tag && !ignoreTag) {
        image = `${image}:${tag}`;
    }
    // let image = `${registry||''}/${namespace||''}/${repository||''}:${tag||''}`;
    // image = image.replace('//','/');
    return image;
}


const exportFromRegistry = async (outFolder, versionsFile) => {
    const fileContents = fs.readFileSync(versionsFile, 'utf8');
    const versions = jsyaml.loadAll(fileContents);
    const imageList = []
    console.log(`Downloading version ${versions[0].systemversion} to ${outFolder}`)
    await fs.mkdirp(`${outFolder}/${versions[0].systemversion}`);
    const images = Object.entries(versions[0]).filter(([k, v]) => v.image).map(([k, v]) => ({ name: k, image: v.image }));
    let counter = images.length+1;
    images.forEach(async (image,i) => {
        try {
            const fullImageName = _createImageName(image.image);
            console.log(`starts ${fullImageName} ${i}/${images.length}`)
            const fileName = fullImageName.replace(/[\/:]/gi, '_')
            await docker.command(`pull ${fullImageName}`)
            await docker.command(`save -o ${outFolder}/${versions[0].systemversion}/${fileName}.tar ${fullImageName}`)
            await syncSpawn('gzip',`${outFolder}/${versions[0].systemversion}/${fileName}.tar`);
            console.log(JSON.stringify({
                file: `${fileName}.tar`,
                ...(image.image)
            }))
            counter=counter-1;
            console.log(`finish ${fullImageName} ${i}/${images.length} left ${counter}` )
        } catch (error) {
            console.log(error)
            counter=counter-1;
        }
    })
}


module.exports = {
    exportFromRegistry
};
    //   imageList.push({
    //     file: `${fileName}.tar`,
    //     ...(v.image)
    // })
    // for(v of images) {
    //     const fullImageName = createImageName(v.image);
    //     const fileName = fullImageName.replace(/[\/:]/gi, '_')

    //     await syncSpawn(`docker`, `pull ${fullImageName}`)
    //     await syncSpawn(`docker`, `save -o ${outFolder}/${versions[0].systemversion}/${fileName}.tar ${fullImageName}`)
    //     imageList.push({
    //         file: `${fileName}.tar`,
    //         ...(v.image)
    //     })
    // }

    //console.log(imageList)

