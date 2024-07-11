import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!TELEGRAM_BOT_TOKEN || !WEBHOOK_URL) {
    console.error('Missing TELEGRAM_BOT_TOKEN or WEBHOOK_URL in environment variables.');
    process.exit(1);
}

const setWebhook = async () => {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
            url: WEBHOOK_URL
        });

        if (response.data.ok) {
            console.log('Webhook set successfully');
        } else {
            console.error('Error setting webhook:', response.data);
        }
    } catch (error) {
        console.error('Error setting webhook:', error);
    }
};

setWebhook();
