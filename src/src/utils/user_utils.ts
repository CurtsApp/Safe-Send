import { BaseDirectory, createDir, exists, FsOptions, readBinaryFile, readTextFile, removeFile, writeBinaryFile, writeTextFile } from "@tauri-apps/api/fs";
import { Contact } from "../interfaces/Contact";
import { SavedUser, User } from "../interfaces/User";
import { GetContact, GetSavedContact } from "./contact_utils";
import { GenerateAesPasswordKey, GenerateUserProfileIV, USER_PROFILE_IV_LENGTH, USER_PROFILE_SALT_LENGTH } from "./crypto_utils";

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

    // User profile format is (salt, IV, encryptedUserData)
    await writeBinaryFile(locationPath, user.profileSalt, fsOptions);

    // Generate new IV, this should be unique for every file write to avoid exposing key
    const iv = GenerateUserProfileIV();
    await writeBinaryFile(locationPath, iv, { dir: fsOptions?.dir, append: true });

    // Encrypt user data
    const textEncoder = new TextEncoder();
    const savedUserJson = textEncoder.encode(JSON.stringify(savedUser));

    const encryptedUserData = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        user.userDataEncryptionKey,
        savedUserJson
    );

    await writeBinaryFile(locationPath, encryptedUserData, { dir: fsOptions?.dir, append: true });
}



export function GetUserFromPath(path: string, password: string, fsOptions?: FsOptions): Promise<User | undefined> {
    return new Promise((resolve, reject) => {
        readBinaryFile(path, fsOptions).then(async userFile => {
            const salt = userFile.subarray(0, USER_PROFILE_SALT_LENGTH);
            const iv = userFile.subarray(USER_PROFILE_SALT_LENGTH, USER_PROFILE_SALT_LENGTH + USER_PROFILE_IV_LENGTH);

            const aesKey = await GenerateAesPasswordKey(password, salt).catch(() => reject());

            if (!aesKey) {
                // Failed to generate key
                reject()
                return;
            }
            // Rest of file, not including salt
            const encryptedUserData = userFile.subarray(USER_PROFILE_SALT_LENGTH + USER_PROFILE_IV_LENGTH);
            const decryptedUserData = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                aesKey,
                encryptedUserData
            );

            if (!decryptedUserData) {
                // Password invalid
                reject();
                return;
            }

            const textDecoder = new TextDecoder();
            let savedUser = JSON.parse(textDecoder.decode(decryptedUserData)) as SavedUser;
            if (!savedUser) {
                // Unable to parse decrypted user profile
                reject();
                return;
            }

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
                        ["encrypt", "wrapKey"]
                    ),
                    privateKey: await crypto.subtle.importKey(
                        "jwk",
                        savedUser.encryptionKeyPrivate,
                        {
                            name: "RSA-OAEP",
                            hash: "SHA-256"
                        },
                        true,
                        ["decrypt", "unwrapKey"]
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
                contacts: contacts,
                profileSalt: salt,
                userDataEncryptionKey: aesKey
            }

            // Success, user profile decoded with provided password
            resolve(user);
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

export function GetUserProfilePath(userName: string) {
    return `${USER_PROFILE_DIR}/${userName}.up`
}