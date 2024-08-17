import { BaseDirectory, createDir, exists, FsOptions, readBinaryFile, readTextFile, removeFile, writeTextFile } from "@tauri-apps/api/fs";
import { Contact } from "../interfaces/Contact";
import { SavedUser, User } from "../interfaces/User";
import { GetContact, GetSavedContact } from "./contact_utils";

export const USER_PROFILE_DIR = "user_profiles";
export const USER_PROFILE_BASE_DIR = { dir: BaseDirectory.AppLocalData };
export function GetContactFromUser(user: User) {
    return {
        name: user.name,
        note: user.note,
        publicEncryptionKey: user.encryptionKeys.publicKey,
        publicSigningKey: user.signingKeys.publicKey
    } as Contact;
}

export async function SaveUser(user: User, locationPath: string, fsOptions?: FsOptions) {
    let getContactPromises = user.contacts.map(async contact => await GetSavedContact(contact));
    let contacts = await Promise.all(getContactPromises);

    let savedUser: SavedUser = {
        encryptionKeyPublic: await crypto.subtle.exportKey("jwk", user.encryptionKeys.publicKey),
        encryptionKeyPrivate: await crypto.subtle.exportKey("jwk", user.encryptionKeys.privateKey),
        signingKeyPublic: await crypto.subtle.exportKey("jwk", user.signingKeys.publicKey),
        singingKeyPrivate: await crypto.subtle.exportKey("jwk", user.signingKeys.privateKey),
        name: user.name,
        note: user.note,
        contacts: contacts
    };

    return writeTextFile(locationPath, JSON.stringify(savedUser), fsOptions);
}

interface ReadUserFile {
    userProfileFile: string;
    user: User;
}

export function GetUserFromPath(path: string, fsOptions?: FsOptions): Promise<ReadUserFile | undefined> {
    return new Promise((resolve, reject) => {
        readTextFile(path, fsOptions).then(async userFile => {
            let savedUser = JSON.parse(userFile) as SavedUser;
            if (savedUser) {
                let contactPromises = savedUser.contacts.map(savedContact => GetContact(savedContact));
                let contacts = await Promise.all(contactPromises);
                let user: User = {
                    name: savedUser.name,
                    note: savedUser.note,
                    encryptionKeys: {
                        publicKey: await crypto.subtle.importKey(
                            "jwk",
                            savedUser.encryptionKeyPublic,
                            {
                                name: "RSA-OAEP",
                                hash: "SHA-256"
                            },
                            true,
                            ["encrypt"]
                        ),
                        privateKey: await crypto.subtle.importKey(
                            "jwk",
                            savedUser.encryptionKeyPrivate,
                            {
                                name: "RSA-OAEP",
                                hash: "SHA-256"
                            },
                            true,
                            ["decrypt"]
                        )
                    },
                    signingKeys: {
                        publicKey: await crypto.subtle.importKey(
                            "jwk",
                            savedUser.signingKeyPublic,
                            {
                                name: "ECDSA",
                                namedCurve: "P-384"
                            },
                            true,
                            ["verify"]
                        ),
                        privateKey: await crypto.subtle.importKey(
                            "jwk",
                            savedUser.singingKeyPrivate,
                            {
                                name: "ECDSA",
                                namedCurve: "P-384"
                            },
                            true,
                            ["sign"]
                        )
                    },
                    contacts: contacts
                }
                resolve({
                    user: user,
                    userProfileFile: userFile
                });
            } else {
                reject();
            }
        })
    });
}

export function DeleteFile(path: string, fsOptions?: FsOptions) {
    removeFile(path, fsOptions);
}

export async function VerifyUserProfilesDirectoryExists() {
    const userProfilesDirExists = await exists(USER_PROFILE_DIR, USER_PROFILE_BASE_DIR);

    if (!userProfilesDirExists) {
        createDir(USER_PROFILE_DIR, USER_PROFILE_BASE_DIR);
    }
}