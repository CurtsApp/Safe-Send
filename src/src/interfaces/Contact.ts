export interface Contact {
    name: string;
    note?: string;

    publicEncryptionKey: CryptoKey;
}

export interface SavedContact {
    name: string;
    note?: string;

    publicEncryptionKey: JsonWebKey;
}