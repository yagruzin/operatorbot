import bot from '../bot.js'

export default async function handler(req, res) {
    const { body } = req;
    if (body && body.update_id) {
        const updates = [body];
        await bot.receiveUpdates(updates);
        res.json({ status: true });
    } else {
        res.json({ status: false });
    }
}
