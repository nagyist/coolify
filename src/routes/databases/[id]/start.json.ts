import { asyncExecShell, createDirectories, getEngine, getUserDetails } from '$lib/common';
import * as db from '$lib/database';
import { checkCoolifyProxy, generateDatabaseConfiguration, generatePassword } from '$lib/database';
// import { databaseQueue } from '$lib/queues';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import type { RequestHandler } from '@sveltejs/kit';
import cuid from 'cuid';
import { makeLabelForDatabase } from '$lib/buildPacks/common';
import { configureProxyForDatabase, startCoolifyProxy } from '$lib/haproxy';

export const post: RequestHandler<Locals, FormData> = async (request) => {
    const { teamId, status, body } = await getUserDetails(request);
    if (status === 401) return { status, body }
    
    const { id } = request.params

    try {
        const database = await db.getDatabase({ id, teamId })
        const { type, destinationDockerId, destinationDocker, port, settings: { isPublic } } = database
        const { url, privatePort, environmentVariables, image, volume, ulimits } = generateDatabaseConfiguration(database);

        const network = destinationDockerId && destinationDocker.network
        const host = getEngine(destinationDocker.engine)
        const engine = destinationDocker.engine
        const volumeName = volume.split(':')[0]
        const labels = await makeLabelForDatabase({ id, image, volume })

        const { workdir } = await createDirectories({ repository: type, buildId: id })

        const composeFile = {
            version: '3.8',
            services: {
                [id]: {
                    container_name: id,
                    image,
                    networks: [network],
                    environment: environmentVariables,
                    volumes: [volume],
                    ulimits,
                    labels
                }
            },
            networks: {
                [network]: {
                    external: true
                }
            },
            volumes: {
                [volumeName]: {
                    external: true
                }
            }
        };
        const composeFileDestination = `${workdir}/docker-compose.yaml`
        await fs.writeFile(composeFileDestination, yaml.dump(composeFile))
        try {
            await asyncExecShell(`DOCKER_HOST=${host} docker volume create ${volumeName}`)
        } catch (error) {
            console.log(error)
        }
        try {
            await asyncExecShell(`DOCKER_HOST=${host} docker-compose -f ${composeFileDestination} up -d`)
            await db.setDatabase({ id, url })
            if (destinationDockerId) {
                const found = await checkCoolifyProxy(engine)
                if (!found) await startCoolifyProxy(engine)
                await configureProxyForDatabase({ id, port, isPublic, privatePort })
            }
            return {
                status: 200
            }
        } catch (error) {
            return {
                status: 500,
                body: {
                    message: error
                }
            }
        }

    } catch (err) {
        return err
    }

}