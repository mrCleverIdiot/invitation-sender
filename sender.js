
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import { resolve } from 'path';
import csv from "csv-parser";
import fs from "fs";

const { Client, MessageMedia } = pkg;

import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
    puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    webCache: false, // Disable web cache
});
client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("QR Code generated. Please scan with your phone.");
});

client.on("authenticated", () => {
    console.log("✅ Authentication successful!");
});

client.on("auth_failure", (msg) => {
    console.error("❌ Authentication failed:", msg);
});

client.on("loading_screen", (percent, message) => {
    console.log(`Loading: ${percent}% - ${message}`);
});

client.on("change_state", (state) => {
    console.log(`State changed to: ${state}`);
});

client.on("ready", () => {
    console.log("✅✅✅ Client is ready! Starting to send messages...");
    const phoneNumbers = [];
    const messages = [];

    // Read phone numbers and messages from CSV file
    fs.createReadStream("messages.csv")
        .pipe(csv())
        .on("data", (data) => {
            const phoneNumber = data.phoneNumber.trim();
            const message = data.message.trim();
            if (phoneNumber && message) {
                phoneNumbers.push("91" + phoneNumber + "@c.us");
                messages.push(message);
                console.log(`Loaded: ${phoneNumber} -> ${message.substring(0, 30)}...`);
            }
        })
        .on("error", (error) => {
            console.error("❌ Error reading CSV file:", error.message);
        })
        .on("end", () => {
            console.log(`Found ${phoneNumbers.length} phone numbers to send messages to`);
            
            if (phoneNumbers.length === 0) {
                console.error("❌ No phone numbers found in CSV file!");
                return;
            }
            
            // Send messages to each phone number with delay of 2 seconds between each message
            phoneNumbers.forEach((phoneNumber, index) => {
                const message = messages[index];
                
                setTimeout(async () => {
                    try {
                        console.log(`Processing number ${index + 1} of ${phoneNumbers.length}: ${phoneNumber}`);
                        console.log(`Message: ${message}`);
                        
                        // Send text message
                        const result = await client.sendMessage(phoneNumber, message);
                        console.log(`✅ Successfully sent message to ${phoneNumber}`);
                        
                        // Optionally send attachment if ATTACHEMENT_PATH is set
                        if (process.env.ATTACHEMENT_PATH) {
                            try {
                                const resolvedAttachmentPath = resolve(process.env.ATTACHEMENT_PATH);
                                const media = MessageMedia.fromFilePath(resolvedAttachmentPath);
                                await client.sendMessage(phoneNumber, media);
                                console.log(`✅ Successfully sent attachment to ${phoneNumber}`);
                            } catch (attachmentError) {
                                console.error(`❌ Failed to send attachment to ${phoneNumber}:`, attachmentError.message);
                            }
                        }
                        
                        console.log("-------------------------------");
                    } catch (error) {
                        console.error(`❌ Failed to send message to ${phoneNumber}:`, error.message);
                        console.log("-------------------------------");
                    }
                }, (index + 1) * 2000); // delay in milliseconds
            });
        });
});


client.on("remote_session_saved", async () => {
    console.log("Saved session");
});

client.on("disconnected", (reason) => {
    console.log("❌ Client disconnected:", reason);
});

client.on("message", (msg) => {
    // Optional: log incoming messages for debugging
    // console.log("Received message:", msg.from, msg.body);
});

// Add a timeout check to see if ready event fires
setTimeout(() => {
    if (!client.info) {
        console.log("⚠️  Warning: Client ready event hasn't fired after 30 seconds");
        console.log("This might indicate a connection issue. Try restarting the script.");
    }
}, 30000);

client.initialize();
