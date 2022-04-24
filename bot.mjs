import {readFileSync} from 'fs'
import {MongoClient} from "mongodb"
import {API, Upload, Updates, Attachment, Keyboard} from 'vk-io'

const owner_id = parseInt(process.env.PUBLIC),
    mongo = await MongoClient.connect(process.env.MONGODB),
    api = new API({token: process.env.TOKEN, apiLimit: 20}),
    users = mongo.db('Vezdekod').collection('Users'),
    cards = JSON.parse(readFileSync('data/cards.json').toString()),
    userDefaults = {cards: [], currentCards: [], currentWord: null, score: 0},
    buttons = {start: Keyboard.textButton({label: 'Старт', color: Keyboard.POSITIVE_COLOR})}

export default new Updates({api, upload: new Upload({api})})
    .on('message_new', async context => {
        const user = context.state.user = await fetchUser(context.senderId);
        switch (context.text?.trim().toLowerCase()) {
            case 'начать':
            case 'старт':
                await updateUser(user, userDefaults)
                return await riddleCards(context, user);
            default:
                if (!context.state.user?.currentWord) return await context.send('Отправьте слово "Старт" чтобы получить изображения', {keyboard: Keyboard.keyboard([buttons.start]).oneTime()})
                const isCorrect = checkWordInCard(context.state.user.currentWord, Object.keys(cards)[parseInt(context.text?.trim()) - 1])
                if (isCorrect) {
                    await updateUser(user, {score: user.score += 3})
                    await context.send(`Верно 🎉\r\nВаш счет: ${user.score || 0}`)
                } else await context.send(`Не верно 🙄\r\nВаш счет: ${user.score || 0}`)
                return await riddleCards(context, user)
        }
    });

async function riddleCards(context, user) {
    const remainCards = getRemainCards(Object.keys(cards), user),
        currentCards = getRandomItemsFromArray(remainCards, 5),
        uniqWords = getUniqWordsForCards(currentCards),
        currentWord = getRandomItemsFromArray(uniqWords, 1).pop(),
        attachment = currentCards.map(id => new Attachment({api, type: 'photo', payload: {id, owner_id}})),
        keyboard = Keyboard.keyboard([currentCards.map(card => Keyboard.textButton({label: (Object.keys(cards).indexOf(card) + 1).toString()})), buttons.start]).oneTime()
    if (!currentCards.length) return await context.send('Карты закончились 😢 — отправьте Старт чтобы начать заново', {keyboard: Keyboard.keyboard([buttons.start]).oneTime()})
    await Promise.all([
        context.send('', {attachment}),
        appendUserCards(user, currentCards),
        updateUser(user, {currentWord, currentCards})
    ])
    return await context.send(`Укажите номер карточки, которая связана со словом: ${currentWord}`, {keyboard})
}

function getRandomItemsFromArray(array, count) {
    return array.sort(() => 0.5 - Math.random()).slice(0, count)
}

async function fetchUser(id) {
    const data = await users.findOne({id})
    return {...data || userDefaults, id}
}

async function updateUser({id} = {}, data) {
    return await users.updateOne({id}, {$set: data}, {upsert: true})
}

function getRemainCards(allCards = [], {cards = []} = {}) {
    if (!Array.isArray(cards)) cards = [];
    return allCards.filter(card => !cards.includes(card))
}

function appendUserCards({id, cards = []} = {}, newCards = []) {
    const uniqCards = new Set([...Array.isArray(cards) ? cards : [], ...newCards])
    return updateUser({id}, {cards: [...uniqCards]})
}

function getCardWords(card) {
    return cards[card]?.trim()?.toLowerCase()?.split(' ')?.filter(Boolean)
}

function getUniqWordsForCards(targetCards = []) {
    const allWords = targetCards.flatMap(getCardWords),
        countWords = allWords.reduce((cnt, cur) => (cnt[cur] = cnt[cur] + 1 || 1, cnt), {})
    return Object.entries(countWords).filter(([word, count]) => count === 1).map(([word, count]) => word)
}

function checkWordInCard(word, card) {
    const words = getCardWords(card) || []
    return words.includes(word)
}
