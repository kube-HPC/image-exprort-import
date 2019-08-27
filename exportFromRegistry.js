const fs = require('fs-extra');
const jsyaml = require('js-yaml');
const { Docker } = require('docker-cli-js');
const syncSpawn = require('./helpers/sync-spawn');
const objectPath = require('object-path');
const merge = require('lodash.merge');
const uniqBy = require('lodash.uniqby');
const { coreImages } = require('./images');
const docker = new Docker();
const _createImageName = ({ registry, namespace, repository, tag }, ignoreTag) => {
    let array = [registry, namespace, repository];
    array = array.filter(a => a);
    let image = array.join('/');
    if (tag && !ignoreTag) {
        image = `${image}:${tag}`;
    }
    return image;
}

const _parseImageName = (image) => {
    var match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/)
    if (!match) return null

    var registry = match[1]
    var namespace = match[2]
    var repository = match[3]
    var tag = match[4]

    if (!namespace && registry && !/[:.]/.test(registry)) {
        namespace = registry
        registry = null
    }

    var result = {
        registry: registry || null,
        namespace: namespace || null,
        repository: repository,
        tag: tag || null
    }

    registry = registry ? registry + '/' : ''
    namespace = namespace && namespace !== 'library' ? namespace + '/' : ''
    tag = tag && tag !== 'latest' ? ':' + tag : ''

    result.name = registry + namespace + repository + tag
    result.fullname = registry + (namespace || 'library/') + repository + (tag || ':latest')

    return result
}

const exportFromRegistry = async (outFolder, versionsFile, registry, prevVersionsFile) => {
    const fileContents = fs.readFileSync(versionsFile, 'utf8');
    const versions = jsyaml.loadAll(fileContents);
    let prevVersions = null;
    if (prevVersionsFile) {
        const prevFileContents = fs.readFileSync(prevVersionsFile, 'utf8');
        prevVersions = jsyaml.loadAll(prevFileContents);

    }
    const imageList = []
    console.log(`Downloading version ${versions[0].systemversion} to ${outFolder}`)
    if (prevVersions) {
        console.log(`Comparing to version ${prevVersions[0].systemversion}`)
    }
    await fs.mkdirp(`${outFolder}/${versions[0].systemversion}`);
    let images = Object.entries(versions[0]).filter(([k, v]) => v.image).map(([k, v]) => ({ name: k, image: v.image }));
    images = images.concat(...coreImages)
    let counter = images.length + 1;
    images.forEach(async (image, i) => {
        try {
            if (prevVersions && prevVersions[0]){
                const prev = prevVersions[0][image.name];
                if (prev){
                    if (prev.image.repository === image.image.repository && prev.image.tag === image.image.tag){
                        console.log(`skipping ${image.name} as its version ${image.image.tag} has not changed`)
                        return;
                    }
                }
            }
            const fullImageName = _createImageName(image.image);
            console.log(`starts ${fullImageName} ${i}/${images.length}`)
            const fileName = fullImageName.replace(/[\/:]/gi, '_')
            await docker.command(`pull ${fullImageName}`)
            await docker.command(`save -o ${outFolder}/${versions[0].systemversion}/${fileName}.tar ${fullImageName}`)
            await syncSpawn('gzip', `${outFolder}/${versions[0].systemversion}/${fileName}.tar`);
            console.log(JSON.stringify({
                file: `${fileName}.tar`,
                ...(image.image)
            }))
            counter = counter - 1;
            console.log(`finish ${fullImageName} ${i}/${images.length} left ${counter}`)
        } catch (error) {
            console.log(error)
            counter = counter - 1;
        }
    })
}

const exportThirdparty = async (outFolder, helmChartFolder, registry, production = true) => {
    try {
        const outFileName = '/tmp/thirdPartyHelm.yaml';
        const outStream = fs.createWriteStream(outFileName);
        await syncSpawn('helm', `template --name hkube --set global.production=${production} ${helmChartFolder}`, undefined, { stdout: outStream });
        let fileContents = fs.readFileSync(outFileName, 'utf8');
        fileContents = fileContents.replace(/^---(?!$)/gm, '---\r\n')
        const yml = jsyaml.safeLoadAll(fileContents);
        let images = [];
        for (y of yml) {
            if (!y) {
                continue;
            }

            const containers = [];
            if (y.kind === 'EtcdCluster') {
                // special handling of etcd operator object
                const version = objectPath.get(y, 'spec.version');
                const repository = objectPath.get(y, 'spec.repository', 'quay.io/coreos/etcd');
                if (version && repository) {
                    const image = `${repository}:${version}`;
                    const imageParsed = _parseImageName(image);
                    const x = merge(imageParsed, { registry })
                    const container = {
                        image: `${repository}:v${version}`,
                        paths: [
                            {
                                path: 'spec.version',
                                value: version
                            },
                            {
                                path: 'spec.repository',
                                value: _createImageName(x, true)
                            }
                        ]
                    }
                    containers.push(container);
                }

                const busyboxImage = objectPath.get(y, 'spec.pod.busyboxImage', 'busybox:1.28.0-glibc');
                if (busyboxImage) {
                    const image = busyboxImage;
                    const imageParsed = _parseImageName(image);
                    const x = merge(imageParsed, { registry })
                    const container = {
                        image,
                        paths: [
                            {
                                path: 'spec.pod.busyboxImage',
                                value: _createImageName(x)
                            }
                        ]
                    }
                    containers.push(container);
                }
            }
            else {
                let containersFromYaml = objectPath.get(y, 'spec.template.spec.containers');
                if (!containersFromYaml) {
                    containersFromYaml = objectPath.get(y, 'spec.jobTemplate.spec.template.spec.containers');
                }
                if (!containersFromYaml) {
                    containersFromYaml = objectPath.get(y, 'spec.containers');
                }
                if (containersFromYaml) {
                    containers.push(...containersFromYaml);
                }
            }
            if (containers.length === 0) {
                continue;
            }

            containers.forEach(c => {
                const imageParsed = _parseImageName(c.image);
                const imageName = imageParsed.repository;
                const x = merge(imageParsed, { registry, fullImageName: c.image })
                if (y.kind === 'EtcdCluster') {
                    c.paths.forEach(p => {
                        objectPath.set(y, p.path, p.value);
                    })
                }
                else {
                    const forImageName = merge(imageParsed, { registry });
                    c.image = _createImageName(forImageName)
                }
                images.push(x);
                console.log(`service ${imageName}. found version ${imageParsed.tag}`)
                return;
            })
        }
        await fs.mkdirp(`${outFolder}/thirdparty`);
        images = uniqBy(images, i => i.fullImageName);
        let counter = images.length + 1;
        images.forEach(async (image, i) => {
            try {
                const fullImageName = image.fullImageName;
                console.log(`starts ${fullImageName} ${i}/${images.length}`)
                const fileName = fullImageName.replace(/[\/:]/gi, '_')
                await docker.command(`pull ${fullImageName}`)
                await docker.command(`save -o ${outFolder}/thirdparty/${fileName}.tar ${fullImageName}`)
                await syncSpawn('gzip', `${outFolder}/thirdparty/${fileName}.tar`);
                console.log(JSON.stringify({
                    file: `${fileName}.tgz`,
                    ...(image.image)
                }))
                counter = counter - 1;
                console.log(`finish ${fullImageName} ${i}/${images.length} left ${counter}`)
            } catch (error) {
                console.log(error)
                counter = counter - 1;
            }
        })
        console.log(images)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    exportFromRegistry,
    exportThirdparty
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

