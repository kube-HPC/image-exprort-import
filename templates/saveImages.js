const createScript=(hkubeImages, thirdpartyImages)=>`
#!/bin/bash
hkubeImages="
${hkubeImages}
"
thirdpartyImages="
${thirdpartyImages}
"

usage () {
    echo "USAGE: $0 [pull] [push] [move] [--images hkube-images.tar.gz]"
    echo "  [pull] pull images from docker hub."
    echo "  [push] push images to registry."
    echo "  [move] pull from docker hub and push images to registry (without writing to file)."
    echo "  [-i|--images path] tar.gz generated by docker save."
    echo "  [-r|--registry] docker registry to push to."
    echo "  [-h|--help] Usage message"
}

images="hkube-images.tar.gz"

while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -i|--images)
        images="$2"
        shift # past argument
        shift # past value
        ;;
        -r|--registry)
        registry="$2"
        shift # past argument
        shift # past value
        ;;
        -s|--split)
        split="$2"
        shift # past argument
        shift # past value
        ;;
        pull)
        pull="true"
        shift # past argument
        ;;
        push)
        push="true"
        shift # past argument
        ;;
        move)
        move="true"
        shift # past argument
        ;;
        -h|--help)
        help="true"
        shift
        ;;
        *)
        usage
        exit 1
        ;;
    esac
done

move () {
    for i in $hkubeImages $thirdpartyImages
    do
    [ -z "\${i}" ] && continue
    echo "Pulling: \${i}"
    if docker pull "\${i}" > /dev/null 2>&1; then
        echo "Image pull success: \${i}"
        pulled="\${pulled} \${i}"
        image_name="\${registry}/\${i}"

        docker tag "\${i}" "\${image_name}"
        docker push "\${image_name}"
    else
        if docker inspect "\${i}" > /dev/null 2>&1; then
            pulled="\${pulled} \${i}"		
        else
            echo "Image pull failed: \${i}"
        fi
    fi
    done

}
pull () {
    for i in $hkubeImages $thirdpartyImages
    do
    [ -z "\${i}" ] && continue
    echo "Pulling: \${i}"
    if docker pull "\${i}" > /dev/null 2>&1; then
        echo "Image pull success: \${i}"
        pulled="\${pulled} \${i}"
    else
        if docker inspect "\${i}" > /dev/null 2>&1; then
            pulled="\${pulled} \${i}"		
        else
            echo "Image pull failed: \${i}"
        fi
    fi
    done
    echo "Creating \${images} with $(echo \${pulled} | wc -w | tr -d '[:space:]') images"
    docker save $(echo \${pulled}) | gzip --stdout > \${images}
    if [[ $split ]]; then
      split -b $split \${images} 
    fi
}

push () {
    echo loading \${images}
    docker load -i \${images}
    echo pushing to registry $registry
    for i in $hkubeImages $thirdpartyImages; do
        [ -z "\${i}" ] && continue
        image_name="\${registry}/\${i}"

        docker tag "\${i}" "\${image_name}"
        docker push "\${image_name}"
    done
}
if [[ $help ]]; then
    usage
    exit 0
fi

if [[ $pull ]]; then
    pull
    exit 0
fi
if [[ $push ]]; then
    if [ -z $registry ]; then
        echo --registry is required
        usage
        exit 0
    fi
    push
    exit 0
fi
if [[ $move ]]; then
    if [ -z $registry ]; then
        echo --registry is required
        usage
        exit 0
    fi
    move
    exit 0
fi
usage
`
module.exports=createScript