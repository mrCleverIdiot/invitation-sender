
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

// ============================================
// CUSTOM MESSAGE - Edit this message as needed
// ============================================
const CUSTOM_MESSAGE = `નમસ્કાર 🙏
અમારા પરિવારમાં લગ્નનો આ પવિત્ર પ્રસંગ આવ્યો છે,
તમારા સ્નેહ અને આશીર્વાદ વગર આ દિવસ અધૂરો છે.
કૃપા કરીને સમય કાઢી આવી અમારી ખુશીમાં જોડાશો,
આપની ઉપસ્થિતિ અમારે માટે વિશેષ અને અમૂલ્ય છે 💐`;

// Helper function to normalize phone number
function normalizePhoneNumber(phoneNumber) {
    // Remove all whitespaces
    let cleaned = phoneNumber.trim().replace(/\s+/g, '');
    
    // If length > 10, check if it starts with +91 or 91
    if (cleaned.length > 10) {
        if (cleaned.startsWith('+91')) {
            // Remove +91 prefix and take last 10 digits
            cleaned = cleaned.substring(3);
        } else if (cleaned.startsWith('91')) {
            // Remove 91 prefix and take last 10 digits
            cleaned = cleaned.substring(2);
        }
        // Take last 10 digits in case of any other format
        if (cleaned.length > 10) {
            cleaned = cleaned.slice(-10);
        }
    }
    
    return cleaned;
}

// Helper function to log failed phone numbers
function logFailedNumber(phoneNumber) {
    const logFile = 'failed_numbers.log';
    const timestamp = new Date().toISOString();
    const logEntry = `${phoneNumber}\n`;
    
    try {
        fs.appendFileSync(logFile, logEntry, 'utf8');
        console.log(`📝 Failed number logged to ${logFile}`);
    } catch (error) {
        console.error(`❌ Failed to write to log file:`, error.message);
    }
}

client.on("ready", () => {
    console.log("✅✅✅ Client is ready! Starting to send messages...");
    const phoneNumbers = [];
    const originalNumbers = []; // Store original numbers for logging

    // Read phone numbers from CSV file
    fs.createReadStream("messages.csv")
        .pipe(csv())
        .on("data", (data) => {
            const rawPhoneNumber = data.phoneNumber?.trim();
            if (rawPhoneNumber) {
                // Normalize phone number (remove whitespaces and handle +91/91 prefix)
                const normalizedNumber = normalizePhoneNumber(rawPhoneNumber);
                
                if (normalizedNumber.length === 10) {
                    phoneNumbers.push("91" + normalizedNumber + "@c.us");
                    originalNumbers.push(rawPhoneNumber); // Keep original for logging
                    console.log(`Loaded: ${rawPhoneNumber} → ${normalizedNumber}`);
                } else {
                    console.warn(`⚠️  Skipped invalid phone number: ${rawPhoneNumber} (normalized: ${normalizedNumber}, length: ${normalizedNumber.length})`);
                }
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
            
            console.log(`📝 Message to send: "${CUSTOM_MESSAGE}"`);
            
            // Send messages to each phone number with random delay above 5 seconds but not more than 40 seconds
            let cumulativeDelay = 0;
            phoneNumbers.forEach((phoneNumber, index) => {
                // Generate random delay between 5000ms (5 sec) and 40000ms (40 sec)
                const randomDelay = Math.floor(Math.random() * (40000 - 5000 + 1)) + 5000;
                cumulativeDelay += randomDelay;
                const originalNumber = originalNumbers[index]; // Get original number for logging
                
                setTimeout(async () => {
                    try {
                        console.log(`Processing number ${index + 1} of ${phoneNumbers.length}: ${phoneNumber} (delay: ${randomDelay}ms)`);                        
                        
                        // Send text message
                        const result = await client.sendMessage(phoneNumber, CUSTOM_MESSAGE);
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
                        // Log failed number to file
                        logFailedNumber(originalNumber);
                        console.log("-------------------------------");
                    }
                }, cumulativeDelay); // random delay above 5 seconds but not more than 40 seconds per message
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
