const { config } = require('dotenv')
const { readFile, writeFile } = require('promise-fs')
const { Telegraf, Markup } = require('telegraf')

config()
const { BOT_API_TOKEN, ADMIN_USERNAME } = process.env
const PHRASES_FILE = process.env.PHRASES_FILE || './phrases.json'
const SPEAK_COMMAND = process.env.SPEAK_COMMAND || '/speak'
const SPEAK_PHRASE = process.env.SPEAK_PHRASE || 'Говори'
const REMEMBER_PHRASE = process.env.REMEMBER_PHRASE || 'Запомни'

let phrases = []
let isRemembering = false


const main = async () => {
    if (!BOT_API_TOKEN || !ADMIN_USERNAME) {
        console.error('No BOT_API_TOKEN or ADMIN_USERNAME in the .env file')
        process.exit(-1)
    }
    await loadPhrases()

    const bot = new Telegraf(BOT_API_TOKEN)
    bot.telegram.getMe().then(botInfo => {
        bot.options.username = botInfo.username
    })
    bot.start(ctx => {
        let text = `Привет, я говорю случайными фразами. Чтобы получить случайную фразу, напиши мне \`${SPEAK_PHRASE}\``
        text += '\nЕще меня можно добавить в группу и использовать команду ' + SPEAK_COMMAND 
        if (authAdmin(ctx.chat)) {
            text += `\nЧтобы добавить новую фразу, напиши \`${REMEMBER_PHRASE}\``
        }
        ctx.reply(text, makeKeyboard(authAdmin(ctx.chat)))
    })
    bot.command(SPEAK_COMMAND, ctx => ctx.reply(getRandomPhrase()))
    bot.hears(
        new RegExp(SPEAK_PHRASE, 'i'),
        ctx => ctx.reply(getRandomPhrase())
    )
    bot.hears(
        new RegExp(`^${REMEMBER_PHRASE}`, 'i'),
        ctx => {
            if (!authAdmin(ctx.chat)) {
                ctx.reply(
                    'Я запоминаю фразы только от админа!',
                    makeKeyboard(authAdmin(ctx.chat))
                )
                return
            }
            if (ctx.message.text.trim().toLowerCase() === REMEMBER_PHRASE.toLowerCase()) {
                ctx.reply(
                    'Какую фразу запомнить?',
                    { reply_markup: { remove_keyboard: true } }
                )
                isRemembering = true
                return
            }
            const phrase = ctx.message.text.split(
                new RegExp(`^${REMEMBER_PHRASE}\s*`, 'i')
            )[1].trim()
            addNewPhrase(phrase)
            ctx.reply(
                'Запомнил :)',
                makeKeyboard(authAdmin(ctx.chat))
            )
        }
    )
    bot.on('text', ctx => {
        if (isRemembering && authAdmin(ctx.chat)) {
            isRemembering = false
            addNewPhrase(ctx.message.text)
            ctx.reply(
                'Запомнил :)',
                makeKeyboard(authAdmin(ctx.chat))
            )
            return
        }
        ctx.reply(
            'Не понимаю :(\nНапиши /start чтобы увидеть подсказку',
            makeKeyboard(authAdmin(ctx.chat))
        )
    })

    console.log('Bot is listening')
    bot.launch()
}

const loadPhrases = async () => {
    try {
        const data = await readFile(PHRASES_FILE)
        const parsed = JSON.parse(data.toString())
        if (!Array.isArray(parsed) || !parsed.every(el => typeof el === 'string')) {
            console.error(PHRASES_FILE, 'file is corrupted')
        }
        phrases = parsed
    } catch (e) {
        await savePhrases()
    }
}

const savePhrases = () => writeFile(
    PHRASES_FILE,
    JSON.stringify(phrases),
)

const addNewPhrase = (phrase) => {
    phrases.push(phrase)
    savePhrases()
}

const getRandomPhrase = () => {
    if (phrases.length === 0) {
        return 'Я не знаю ни одной фразы :('
    }
    return phrases[Math.floor(Math.random() * phrases.length)]
}

/** @param chat {import 'telegraf'.Context['chat']} */
const authAdmin = chat =>
    chat.username?.toLowerCase() === ADMIN_USERNAME.toLowerCase()

const makeKeyboard = (isAdmin = false) => {
    const commands = [SPEAK_PHRASE]
    if (isAdmin) {
        commands.push(REMEMBER_PHRASE)
    }
    return Markup.keyboard([commands])
}

main()
