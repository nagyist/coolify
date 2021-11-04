import { dev } from '$app/env'
import * as Prisma from '@prisma/client'
import { default as ProdPrisma } from '@prisma/client'
import { decrypt, encrypt } from './crypto'
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken'
import cuid from 'cuid';

const { SECRET_KEY } = process.env;
const secretKey = SECRET_KEY;

let { PrismaClient } = Prisma
let P = Prisma.Prisma
if (!dev) {
    PrismaClient = ProdPrisma.PrismaClient
    P = ProdPrisma.Prisma
}

export const prisma = new PrismaClient()

function PrismaErrorHandler(e) {
    const payload = {
        status: 500,
        body: {
            message: 'Ooops, something is not okay, are you okay?'
        }
    }
    if (e instanceof P.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
            payload.body.message = "Already exists. Choose another name."
        }
    }
    console.error(e)
    return payload
}


prisma.$use(async (params, next) => {
    // Create DB methods
    if (params.model === 'GithubApp') {
        if (params.action === 'create') {
            const { clientSecret, webhookSecret, privateKey } = params.args.data
            params.args.data.clientSecret = encrypt(clientSecret)
            params.args.data.webhookSecret = encrypt(webhookSecret)
            params.args.data.privateKey = encrypt(privateKey)
        }
    }
    let result = await next(params)

    // Query DB methods
    if (params.args?.include?.githubApp && result?.githubApp) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
            const { clientSecret, webhookSecret, privateKey } = result.githubApp
            result.githubApp.clientSecret = decrypt(clientSecret)
            result.githubApp.webhookSecret = decrypt(webhookSecret)
            result.githubApp.privateKey = decrypt(privateKey)
        }
        if (params.action === 'findMany') {
            result = result.map(r => {
                if (r.githubApp) {
                    const { clientSecret, webhookSecret, privateKey } = r.githubApp
                    r.githubApp.clientSecret = decrypt(clientSecret)
                    r.githubApp.webhookSecret = decrypt(webhookSecret)
                    r.githubApp.privateKey = decrypt(privateKey)
                }
                return r
            })
        }
    }
    if (params.args?.include?.gitSource?.include?.githubApp && result?.gitSource?.githubApp) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
            const { clientSecret, webhookSecret, privateKey } = result.gitSource.githubApp
            result.gitSource.githubApp.clientSecret = decrypt(clientSecret)
            result.gitSource.githubApp.webhookSecret = decrypt(webhookSecret)
            result.gitSource.githubApp.privateKey = decrypt(privateKey)
        }
        if (params.action === 'findMany') {
            result = result.map(r => {
                if (r.gitSource.githubApp) {
                    const { clientSecret, webhookSecret, privateKey } = r.gitSource.githubApp
                    r.gitSource.githubApp.clientSecret = decrypt(clientSecret)
                    r.gitSource.githubApp.webhookSecret = decrypt(webhookSecret)
                    r.gitSource.githubApp.privateKey = decrypt(privateKey)
                }
                return r
            })
        }
    }
    if (params.model === 'GithubApp') {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
            const { clientSecret, webhookSecret, privateKey } = result
            result.clientSecret = decrypt(clientSecret)
            result.webhookSecret = decrypt(webhookSecret)
            result.privateKey = decrypt(privateKey)
        }
        if (params.action === 'findMany') {
            result = result.map(r => {
                const { clientSecret, webhookSecret, privateKey } = r
                r.clientSecret = decrypt(clientSecret)
                r.webhookSecret = decrypt(webhookSecret)
                r.privateKey = decrypt(privateKey)
                return r
            })
        }
    }
    return result
})





// DB functions
export async function listApplications() {
    return await prisma.application.findMany()
}

export async function newApplication({ name }) {
    try {
        const app = await prisma.application.create({ data: { name: name } })
        return { status: 201, body: { id: app.id } }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function getApplication({ id }) {
    try {
        const body = await prisma.application.findUnique({ where: { id }, include: { destinationDocker: true, gitSource: { include: { githubApp: true } } } })
        return { ...body }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function listSources() {
    try {
        const body = await prisma.gitSource.findMany({ include: { githubApp: true } })
        return [...body]
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function newSource({ name, type, htmlUrl, apiUrl, organization }) {
    try {
        const source = await prisma.gitSource.create({ data: { name, type, htmlUrl, apiUrl, organization } })
        return { status: 201, body: { id: source.id } }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}
export async function removeSource({ id }) {
    try {
        // TODO: Disconnect application with this sourceId! Maybe not needed?
        const source = await prisma.gitSource.delete({ where: { id }, include: { githubApp: true } })
        await prisma.githubApp.delete({ where: { id: source.githubAppId } })
        return { status: 200 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function getSource({ id }) {
    try {
        const body = await prisma.gitSource.findUnique({ where: { id }, include: { githubApp: true } })
        return { ...body }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function configureGitsource({ id, gitSourceId }) {
    try {
        await prisma.application.update({ where: { id }, data: { gitSource: { connect: { id: gitSourceId } } } })
        return { status: 201 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function listDestinations() {
    try {
        const body = await prisma.destinationDocker.findMany()
        return [...body]
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function configureDestination({ id, destinationId }) {
    try {
        await prisma.application.update({ where: { id }, data: { destinationDocker: { connect: { id: destinationId } } } })
        return { status: 201 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}
export async function updateDestination({ id, name, isSwarm, engine, network }) {
    try {
        await prisma.destinationDocker.update({ where: { id }, data: { name, isSwarm, engine, network } })
        return { status: 200 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}


export async function newDestination({ name, isSwarm, engine, network }) {
    try {
        const destination = await prisma.destinationDocker.create({ data: { name, isSwarm, engine, network } })
        return {
            status: 201, body: { id: destination.id }
        }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}
export async function removeDestination({ id }) {
    try {
        await prisma.destinationDocker.delete({ where: { id } })
        return { status: 200 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function getDestination({ id }) {
    try {
        const body = await prisma.destinationDocker.findUnique({ where: { id } })
        return { ...body }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function createGithubApp({ id, client_id, slug, client_secret, pem, webhook_secret, state }) {
    try {
        await prisma.githubApp.create({
            data: {
                appId: id,
                name: slug,
                clientId: client_id,
                clientSecret: client_secret,
                webhookSecret: webhook_secret,
                privateKey: pem,
                gitSource: { connect: { id: state } }
            }
        })
        return { status: 201 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}
export async function addInstallation({ gitSourceId, installation_id }) {
    try {
        const source = await prisma.gitSource.findUnique({ where: { id: gitSourceId }, include: { githubApp: true } })
        await prisma.githubApp.update({ where: { id: source.githubAppId }, data: { installationId: Number(installation_id) } })
        return { status: 201 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function isBranchAlreadyUsed({ repository, branch }) {
    try {
        const found = await prisma.application.findFirst({ where: { branch, repository } })
        if (found) {
            return { status: 200 }
        }
        return { status: 404 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function configureRepository({ id, repository, branch }) {
    try {
        await prisma.application.update({ where: { id }, data: { repository, branch } })
        return { status: 201 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function configureBuildPack({ id, buildPack }) {
    try {
        await prisma.application.update({ where: { id }, data: { buildPack } })
        return { status: 201 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function configureApplication({ id, domain, port, installCommand, buildCommand, startCommand, baseDirectory, publishDirectory }) {
    try {
        let application = await prisma.application.findUnique({ where: { id } })
        if (application.domain !== domain && !application.oldDomain) {
            await prisma.application.update({ where: { id }, data: { domain, oldDomain: application.domain, port, installCommand, buildCommand, startCommand, baseDirectory, publishDirectory } })
        } else {
            await prisma.application.update({ where: { id }, data: { domain, port, installCommand, buildCommand, startCommand, baseDirectory, publishDirectory } })
        }

        return { status: 201 }
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function listLogs({ buildId }) {
    try {
        const body = await prisma.buildLog.findMany({ where: { buildId }, orderBy: { time: 'asc' } })
        return [...body]
    } catch (e) {
        return PrismaErrorHandler(e)
    }
}

export async function login({ email, password }) {
    const saltRounds = 15;
    const userFound = await prisma.user.findUnique({ where: { email }, include: { teams: { select: { assignedBy: true, assignedAt: true, teamId: true } } } })
    let uid = cuid()
    let teams = []
    if (userFound) {
        if (userFound.type === 'email') {
            const passwordMatch = await bcrypt.compare(password, userFound.password)
            if (!passwordMatch) {
                return {
                    status: 500,
                    body: {
                        message: 'Wrong password or email address.'
                    }
                };
            }
            uid = userFound.uid
            teams = userFound.teams
        }
    } else {
        const hashedPassword = await bcrypt.hash(password, saltRounds)
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                uid,
                type: 'email',
                teams: {
                    create: {
                        assignedBy: uid,
                        team: {
                            create: {
                                teamId: uid
                            }
                        }
                    }
                }
            }, include: { teams: { select: { assignedBy: true, assignedAt: true, teamId: true } } }
        })
        teams = user.teams
    }
    const token = jsonwebtoken.sign({}, secretKey, {
        expiresIn: 15778800,
        algorithm: 'HS256',
        audience: 'coolify',
        issuer: 'coolify',
        jwtid: uid,
        subject: `User:${uid}`,
        notBefore: -1000
    });
    return {
        status: 200,
        body: {
            uid,
            teams,
            token
        }
    }
}