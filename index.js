"use strict"
const { dlrgAccount, emailAccount, emailConfig } = require('./config.json')
const nodemailer = require("nodemailer")
const moment = require('moment')
const { createClient } = require('webdav')
const path = require('path')

const { utc } = moment

moment.locale('de')

async function getFiles() {
    const webdavClient = createClient(`https://www.dlrg.cloud/remote.php/dav/files/${dlrgAccount.username}/`, {
        username: dlrgAccount.username,
        password: dlrgAccount.password,
    })

    const directoryItems = await webdavClient.getDirectoryContents(dlrgAccount.path)

    return directoryItems
        .filter(item => item.type === 'file')
        .map(item => ({ ...item, lastmod: utc(item.lastmod) }))
        .filter(item => utc().diff(item.lastmod, 'days') > 7)
}

async function getTransporter() {
    return nodemailer.createTransport({
        host: "mail.dlrg.de",
        port: 587,
        secure: false,
        auth: {
            user: emailAccount.username,
            pass: emailAccount.password,
        },
    })
}

async function sendMail(files) {
    const transporter = await getTransporter()

    const belege = formatBelege(files)

    const info = await transporter.sendMail({
        from: `"${emailConfig.senderName}" <${emailConfig.senderEmail}>`,
        to: emailConfig.recipientEmail,
        subject: "Unbearbeite Belege in der Inbox",
        text: `
Moin,

im Ordner '${path.basename(dlrgAccount.path)}' in der DLRG Cloud liegen derzeit folgende unbearbeitete Belege:

${belege}

Viele Grüße
Your friendly shellscript
`,
    })
}

function formatBelege(files) {
    return files
        .map(file => `• ${file.basename} (angelegt ${file.lastmod.format('LLLL')})`)
        .join('\n')
}

async function main() {
    const files = await getFiles()
    if (files.length > 0) {
        await sendMail(files)
    }
}

main()