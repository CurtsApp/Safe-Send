import { Contact, SavedContact } from "./Contact";

export interface User {
    name: string;
    note: string;
    encryptionKeys: CryptoKeyPair;
    signingKeys: CryptoKeyPair;
    contacts: Contact[];
    userDataEncryptionKey: CryptoKey;
    profileSalt: Uint8Array;
}

export interface SavedUser {
    name: string;
    note: string;
    encryptionKeyPublic: JsonWebKey;
    encryptionKeyPrivate: JsonWebKey;
    signingKeyPublic: JsonWebKey;
    singingKeyPrivate: JsonWebKey;
    contacts: SavedContact[];
}