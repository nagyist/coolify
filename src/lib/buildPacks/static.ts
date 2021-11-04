import { buildCacheImageWithNode, buildImage } from '$lib/docker';
import { promises as fs } from 'fs';

const createDockerfile = async ({ applicationId, commit, image, workdir, buildCommand, baseDirectory, publishDirectory }): Promise<void> => {
    let Dockerfile: Array<string> = []
    Dockerfile.push(`FROM ${image}`)
    Dockerfile.push('WORKDIR /usr/share/nginx/html')
    if (buildCommand) {
        Dockerfile.push(`COPY --from=${applicationId}:${commit.slice(0, 7)}-cache /usr/src/app/${publishDirectory} ./`)
    } else {
        Dockerfile.push(`COPY ./${baseDirectory || ""} ./`)
    }
    Dockerfile.push(`EXPOSE 80`)
    Dockerfile.push('CMD ["nginx", "-g", "daemon off;"]')
    await fs.writeFile(`${workdir}/Dockerfile`, Dockerfile.join('\n'))
}

export default async function ({ applicationId, commit, workdir, docker, buildId, installCommand, buildCommand, baseDirectory, publishDirectory }) {
    const image = 'nginx:stable-alpine'
    if (buildCommand) {
        await buildCacheImageWithNode({ applicationId, commit, workdir, docker, buildId, baseDirectory, installCommand, buildCommand })
    }
    await createDockerfile({ applicationId, commit, image, workdir, buildCommand, baseDirectory, publishDirectory })
    await buildImage({ applicationId, commit, workdir, docker, buildId })
}