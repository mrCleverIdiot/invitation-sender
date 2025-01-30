import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import { resolve } from 'path';
import csv from "csv-parser";
import fs from "fs";
import dotenv from 'dotenv';

dotenv.config();

const { Client, LocalAuth, MessageMedia } = pkg;

// Get phone number as argument (Pass the phone number while running the script)
const phoneNumber = process.argv[2]; // Example: node sender.js 919876543210

if (!phoneNumber) {
    console.error("Please provide a phone number to load the session.");
    process.exit(1);
}

// Define session storage directory per user
const sessionDir = `./sessions/${phoneNumber}`;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }), // Store sessions separately per phone number
    puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    webCache: false,
});

client.on("qr", (qr) => {
    console.log(`Scan this QR code for: ${phoneNumber}`);
    qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
    console.log(`Authenticated for: ${phoneNumber}`);
});

client.on("ready", () => {
    console.log(`Client is ready for: ${phoneNumber}`);
    const phoneNumbers = [];
    const messages = [];

    fs.createReadStream("messages.csv")
        .pipe(csv())
        .on("data", (data) => {
            phoneNumbers.push("91" + data.phoneNumber + "@c.us");
            messages.push(data.message);
        })
        .on("end", () => {
            phoneNumbers.forEach((targetNumber, index) => {
                const message = messages[index];

                setTimeout(() => {
                    client.sendMessage(targetNumber, message);
                    console.log(`Sent message to ${targetNumber} from ${phoneNumber}`);
                    console.log("-------------------------------");
                }, (index + 1) * 2000);
            });
        });
});

client.on("remote_session_saved", () => {
    console.log(`Session saved for: ${phoneNumber}`);
});

client.on("disconnected", (reason) => {
    console.log(`Client disconnected for ${phoneNumber} due to: ${reason}`);
});

client.initialize();
