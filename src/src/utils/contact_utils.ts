import { FsOptions, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { Contact, SavedContact } from "../interfaces/Contact";
import { stringSort } from "./general_utils";
import { NotificationCore } from "../components/Notification";

export function GetContactFromPath(path: string, fsOptions?: FsOptions): Promise<Contact> {
    // Rejects with the original file path as reason
    return new Promise((resolve, reject) => {
        readTextFile(path, fsOptions).then(async contact => {
            let savedContact = JSON.parse(contact) as SavedContact;
            if (savedContact) {
                let contact: Contact = await GetContact(savedContact);
                resolve(contact);
            } else {
                reject(path);
            }
        }).catch(() => reject(path));
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
        ),
        publicSigningKey: await crypto.subtle.exportKey(
            "jwk",
            contact.publicSigningKey
        ),
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
            ),
        publicSigningKey:
            await crypto.subtle.importKey(
                "jwk",
                savedContact.publicSigningKey,
                {
                    name: "ECDSA",
                    namedCurve: "P-384"
                },
                true,
                ["verify"]
            ),

    }
}

// Shared functionality between App.tsx and Contacts view
export function ImportContact(paths: string[], contacts: Contact[], updateContacts: (newContacts: Contact[]) => void, sendNotification: (newNotification: NotificationCore) => void) {
    const newContactPromises = paths.map(path => GetContactFromPath(path));

    Promise.allSettled(newContactPromises).then(results => {
        let aContactWasUpdated = false;
        results.forEach(result => {
            if (result.status === "fulfilled") {
                aContactWasUpdated = true;
                contacts.push(result.value);
                contacts.sort((a, b) => {
                    return stringSort(a.name, b.name);
                })
            } else {
                sendNotification(
                    {
                        msg: `Failed to import contact: ${result.reason}`,
                        type: "fail"
                    }
                );
            }
        });

        if(aContactWasUpdated) {
            updateContacts(contacts);
            sendNotification(
                {
                    msg: `Contact added`,
                    type: "success"
                }
            );
        }
    });
}