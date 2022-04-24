import {readFileSync} from 'fs'
import {MongoClient} from "mongodb"
import {API, Upload, Updates, Attachment} from 'vk-io'

const owner_id = parseInt(process.env.PUBLIC),
    mongo = await MongoClient.connect(process.env.MONGODB),
    api = new API({token: process.env.TOKEN, apiLimit: 20}),
    users = mongo.db('Vezdekod').collection('Users'),
    photos = JSON.parse(readFileSync('data/photos.json').toString())

export default new Updates({api, upload: new Upload({api})})
    .on('message_new', async context => {
        const user = context.state.user = await fetchUser(context.senderId);
        switch (context.text.trim().toLowerCase()) {
            case 'начать':
            case 'старт':
                const remainCards = getRemainCards(photos, user),
                    targetCards = getRandomItemsFromArray(remainCards, 5),
                    attachment = targetCards.map(id => new Attachment({api, type: 'photo', payload: {id, owner_id}}))
                if (!targetCards.length) return await context.send('Карты закончились 😢 — отправьте Сброс чтобы начать заново')
                await appendUserCards(user, targetCards)
                return await context.send('', {attachment})
            case 'сброс':
                await updateUser(user, {cards: []})
                return await context.send('Прогресс сброшен')
            default:
                return await context.send('Отправьте слово "Старт" чтобы получить изображения')
        }
    });

function getRandomItemsFromArray(array, count) {
    return array.sort(() => 0.5 - Math.random()).slice(0, count)
}

async function fetchUser(id) {
    const data = await users.findOne({id})
    return {...data || {}, id}
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
