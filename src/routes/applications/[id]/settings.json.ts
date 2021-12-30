import { getUserDetails } from '$lib/common';
import * as db from '$lib/database';
import type { RequestHandler } from '@sveltejs/kit';

export const post: RequestHandler<Locals, FormData> = async (request) => {
    const { status, body } = await getUserDetails(request);
    if (status === 401) return { status, body }

    const { id } = request.params
    const debug = request.body.get('debug') === 'true' ? true : false
    const previews = request.body.get('previews') === 'true' ? true : false

    try {
        return await db.setApplicationSettings({ id, debug, previews })
    } catch (err) {
        return err
    }

}