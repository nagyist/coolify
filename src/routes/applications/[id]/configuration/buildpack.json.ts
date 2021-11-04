import * as db from '$lib/database';
import type { RequestHandler } from '@sveltejs/kit';

export const get: RequestHandler<Locals, FormData> = async (request) => {
    const buildPacks = [{ name: 'node' }, { name: 'static' }]
    return {
        status: 200,
        body: {
            buildPacks
        }
    }
}

export const post: RequestHandler<Locals, FormData> = async (request) => {
    const { id } = request.params
    const buildPack = request.body.get('buildPack') || null
    return await db.configureBuildPack({ id, buildPack })
}
