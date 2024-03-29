const fs = require('fs-extra');
const jsyaml = require('js-yaml');
const path = require('path');
const tempy = require('tempy');
const { Docker } = require('docker-cli-js');
const syncSpawn = require('./helpers/sync-spawn');
const objectPath = require('object-path');
const merge = require('lodash.merge');
const uniqBy = require('lodash.uniqby');
const { coreImages } = require('./images');
const docker = new Docker();
const scriptTemplate = require('./templates/saveImages');
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
    const match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/)
    if (!match) return null

    let registry = match[1]
    let namespace = match[2]
    let repository = match[3]
    let tag = match[4]

    if (!namespace && registry && !/[:.]/.test(registry)) {
        namespace = registry
        registry = null
    }
    
    const result = {
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

const exportFromRegistry = async (outFolder, versionsFile, registry, prevVersionsFile, dryrun = false, saveDockers = true) => {
    const imageNames=[];
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
    if (saveDockers){
        await fs.mkdirp(`${outFolder}/${versions[0].systemversion}`);
    }
    let images = Object.entries(versions[0]).filter(([k, v]) => v.image).map(([k, v]) => ({ name: k, image: v.image }));
    images = images.concat(...coreImages)
    let counter = images.length + 1;
    let i=0;
    for (let image of images) {
        i++
        try {
            if (prevVersions && prevVersions[0]) {
                const prev = prevVersions[0][image.name];
                if (prev) {
                    if (prev.image.repository === image.image.repository && prev.image.tag === image.image.tag) {
                        console.log(`skipping ${image.name} as its version ${image.image.tag} has not changed`)
                        continue;
                    }
                }
            }
            const fullImageName = _createImageName(image.image);
            console.log(`starts ${fullImageName} ${i}/${images.length}`)
            const fileName = fullImageName.replace(/[\/:]/gi, '_')
            if (dryrun) {
                console.log(`docker pull ${fullImageName}`);
                console.log(`docker save -o ${outFolder}/${versions[0].systemversion}/${fileName}.tar ${fullImageName}`)
                console.log(`gzip ${outFolder}/${versions[0].systemversion}/${fileName}.tar`)
            }
            else {
                if (saveDockers){
                    await docker.command(`pull ${fullImageName}`)
                    await docker.command(`save -o ${outFolder}/${versions[0].systemversion}/${fileName}.tar ${fullImageName}`)
                    await syncSpawn('gzip', `${outFolder}/${versions[0].systemversion}/${fileName}.tar`);
                    console.log(JSON.stringify({
                        file: `${fileName}.tar`,
                        ...(image.image)
                    }))
                }
                counter = counter - 1;
                console.log(`finish ${fullImageName} ${i}/${images.length} left ${counter}`)
            }
            imageNames.push(fullImageName);
        } catch (error) {
            console.log(error)
            counter = counter - 1;
        }
    }
    return imageNames;
}

const _getThirdpartyVersions = (yml, registry) => {
    let images = [];
    if (!yml) {
        return images;
    }
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
            // console.log(`service ${imageName}. found version ${imageParsed.tag}`)
            return;
        })
    }
    images = uniqBy(images, i => i.fullImageName);
    return images;
}
const _getYamlFromChart = async (helmChartFolder, options) => {
    try {
        const outFileName = tempy.file();
        const outStream = fs.createWriteStream(outFileName);
        const setOptions = options.split(',').map(s => `--set ${s}`).join(' ');
        await syncSpawn('helm', `template hkube ${setOptions} ${helmChartFolder}`, undefined, { stdout: outStream });
        let fileContents = fs.readFileSync(outFileName, 'utf8');
        fileContents = fileContents.replace(/^---(?!$)/gm, '---\r\n')
        const yml = jsyaml.safeLoadAll(fileContents);
        return yml;
    } catch (e) {
        console.log(e)
        return []
    }
};

const _getYamlsFromChartsFolder = async (helmChartFolder, options) => {
    const chartsFolder = path.join(helmChartFolder, 'charts');
    const thirdpartyFolders = await fs.readdir(chartsFolder);
    const yamls = await Promise.all(thirdpartyFolders.map(f => _getYamlFromChart(path.join(chartsFolder, f), options)));
    const yml = [].concat(...yamls)
    return yml;
};

const exportThirdparty = async (outFolder, helmChartFolder, registry, options = '', prevChartPath = null, saveDockers = true) => {
    const imagesNames = [];
    try {
        const yml = await _getYamlsFromChartsFolder(helmChartFolder, options);
        let prevYml = null;
        if (prevChartPath) {
            prevYml = await _getYamlsFromChartsFolder(prevChartPath, options);
        }
        const imagesNew = _getThirdpartyVersions(yml, registry);
        const prevImages = _getThirdpartyVersions(prevYml, registry);
        const images = imagesNew.filter(i => !prevImages.find(pi => i.fullname === pi.fullname));
        const skippedImages = imagesNew.filter(i => prevImages.find(pi => i.fullname === pi.fullname));
        images.forEach(i => console.log(`found ${i.fullname}`));
        skippedImages.forEach(i => console.log(`skipped ${i.fullname}`));

        if (saveDockers) {
            await fs.mkdirp(`${outFolder}/thirdparty`);
        }
        let counter = images.length + 1;
        let i=0;
        for (let image of images) {
            i++
            try {
                const fullImageName = image.fullImageName;

                console.log(`starts ${fullImageName} ${i}/${images.length}`)
                if (saveDockers) {
                    const fileName = fullImageName.replace(/[\/:]/gi, '_')
                    await docker.command(`pull ${fullImageName}`)
                    await docker.command(`save -o ${outFolder}/thirdparty/${fileName}.tar ${fullImageName}`)
                    await syncSpawn('gzip', `${outFolder}/thirdparty/${fileName}.tar`);
                }
                imagesNames.push(fullImageName);
                counter = counter - 1;
                console.log(`finish ${fullImageName} ${i}/${images.length} left ${counter}`)
            } catch (error) {
                console.log(error)
                counter = counter - 1;
            }
        }
    } catch (error) {
        console.log(error)
    }
    return imagesNames
}

const createScript = async ({ path: outFile, chartPath: helmChartFolder, registry, options = '' }) => {
    const thirdpartyImages = await exportThirdparty('', helmChartFolder, registry, options, null, false);
    const hkubeImages = await exportFromRegistry('', path.join(helmChartFolder, 'values.yaml'), registry, null, false, false)
    const script=scriptTemplate(hkubeImages.join('\n'),thirdpartyImages.join('\n'));

    await fs.writeFile(outFile, script);
    await fs.chmod(outFile, '0775')

}

const createPatterns = async ({ path: outFile, chartPath: helmChartFolder, registry, options = '', patternPrefix='' }) => {
    const thirdpartyImages = await exportThirdparty('', helmChartFolder, registry, options, null, false);
    const hkubeImages = await exportFromRegistry('', path.join(helmChartFolder, 'values.yaml'), registry, null, false, false)
    const files = [];
    for (let image of hkubeImages.concat(thirdpartyImages)) {
        const imageParsed = _parseImageName(image)
        const imageLine = image.replace(':','/').replace('docker.io/','')
        files.push({
            pattern: `${patternPrefix}/${imageLine}/`
        })
        files.push({
            pattern: `${patternPrefix}/*/${imageLine}/`
        })
    }
    const script = JSON.stringify({files}, null, 2);
    await fs.writeFile(outFile, script);
    await fs.chmod(outFile, '0775')

}

module.exports = {
    exportFromRegistry,
    exportThirdparty,
    createScript,
    createPatterns
};
