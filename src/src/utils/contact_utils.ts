import { FsOptions, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { Contact, SavedContact } from "../interfaces/Contact";

export function GetContactFromPath(path: string, fsOptions?: FsOptions): Promise<Contact> {
    return new Promise((resolve, reject) => {
        readTextFile(path, fsOptions).then(async contact => {
            let savedContact = JSON.parse(contact) as SavedContact;
            if (savedContact) {
                let contact: Contact = await GetContact(savedContact);
                resolve(contact);
            } else {
                reject();
            }
        });
    });
}

export async function ExportContact(contact: Contact, locationPath: string, fsOptions?: FsOptions) {
    let savedContact = await GetSavedContact(contact);

    return writeTextFile(locationPath, JSON.stringify(savedContact), fsOptions);
}

export async function GetSavedContact(contact: Contact): Promise<SavedContact> {
    return {
        name: contact.name,
        note: contact.note,
        publicEncryptionKey: await crypto.subtle.exportKey(
            "jwk",
            contact.publicEncryptionKey
        )
    }
}

export async function GetContact(savedContact: SavedContact): Promise<Contact> {
    return {
        name: savedContact.name || "Unknown Contact",
        note: savedContact.note || "",
        publicEncryptionKey:
            await crypto.subtle.importKey(
                "jwk",
                savedContact.publicEncryptionKey,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256"
                },
                true,
                ["encrypt", "wrapKey"]
            )

    }
}