
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import { resolve } from 'path';
import csv from "csv-parser";
import fs from "fs";
import fsPromises from 'fs/promises';
import { PDFDocument, rgb } from 'pdf-lib';
import dotenv from 'dotenv';
import fontkit from '@pdf-lib/fontkit';
const { Client, MessageMedia } = pkg;

dotenv.config();

const client = new Client({
    puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
});

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("Client is ready!");
    const phoneNumbers = [];
    const messages = [];
    const pdfNames = [];

    // Read phone numbers and messages from CSV file
    fs.createReadStream("pdf_messages.csv")
        .pipe(csv())
        .on("data", (data) => {
            phoneNumbers.push("91" + data.phoneNumber + "@c.us");
            messages.push(data.text);
            pdfNames.push(data.phoneNumber)
        })
        .on("end", () => {
            // Send messages to each phone number with delay of 2 seconds between each message
            phoneNumbers.forEach((phoneNumber, index) => {
                const message = messages[index];
                // const message = "Hello,\nThis is a test message with a line break.";

                setTimeout(() => {
                    createPdfWithText(message, process.env.ATTACHEMENT_PATH, pdfNames[index])
                        .then(async (newPdfPath) => {
                            console.log(`Created PDF at: ${newPdfPath}`);
                            const resolvedAttachmentPath = resolve(newPdfPath);

                            const media = MessageMedia.fromFilePath(resolvedAttachmentPath);
                            media.filename = "invitation";
                            try {
                                await client.sendMessage(phoneNumber, media, { caption: ' ' });
                                console.log(`Sent message to ${phoneNumber}`);
                                // Delete the PDF file after sending
                                await fsPromises.unlink(resolvedAttachmentPath);
                                console.log(`Deleted PDF: ${resolvedAttachmentPath}`);
                            } catch (error) {
                                console.error(`Error sending message to ${phoneNumber}:`, error);
                            }
                            console.log("-------------------------------");
                        })
                        .catch((error) => console.error('An error occurred:', error));
                }, (index + 1) * 2000); // delay in milliseconds
            });
        });
});


client.on("remote_session_saved", async () => {
    console.log("Saved session");
});

client.initialize();

async function createPdfWithText(text, existingPdfPath, pdfName) {
    // Load the existing PDF
    const existingPdfBytes = await fsPromises.readFile(existingPdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Register the fontkit instance
    pdfDoc.registerFontkit(fontkit);
    const customFontBytes = await fsPromises.readFile(process.env.FONT_PATH);
    const customFont = await pdfDoc.embedFont(customFontBytes);

    // Get the first page of the document
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Draw the text at the specified location
    firstPage.drawText(text, {
        x: 320,
        y: firstPage.getHeight() - 320, // Adjust y coordinate from the top of the page
        size: 12,
        font: customFont,
        color: rgb(0, 0, 0) // You can set the color as needed
    });

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();

    // Write the modified PDF to a new file
    const newPdfPath = `${pdfName}.pdf`;

    // Write the modified PDF to a new file
    await fsPromises.writeFile(newPdfPath, pdfBytes);

    // Return the file path of the new PDF
    return newPdfPath;
}
