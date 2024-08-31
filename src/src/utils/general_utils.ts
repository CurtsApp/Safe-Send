import { sep } from "@tauri-apps/api/path";

export function stringSort(a: string | undefined, b: string | undefined) {
    if (a === undefined) {
        return -1;
    }
    if (b === undefined) {
        return 1;
    }
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

export function getFirstString(str: string | string[] | null) {
    let firstStr;
    if (Array.isArray(str)) {
        firstStr = str[0];
    } else if (str) {
        firstStr = str;
    }
    return firstStr;
}

export function getFileName(path: string) {
    let pathSplit = path.split(sep);
    let fileName = "";
    if (pathSplit.length > 0) {
        fileName = pathSplit[pathSplit.length - 1];
    }
    return fileName;
}

export function getFileExtension(fileName: string) {
    let fileNameSplit = fileName.split(".");
    let extension = "";
    if(fileNameSplit.length > 1) {
        extension = fileNameSplit[fileNameSplit.length - 1];
    } 

    return extension;
}

export function getExtensionFromPath(path: string) {
    return getFileExtension(getFileName(path));
}

export function getUint32FromOffset(data: Uint8Array, offset: number) {
    return getUint32(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

export function getUint32(byte0: number, byte1: number, byte2: number, byte3: number) {
    const buffer = new ArrayBuffer(4); // Create a buffer of 4 bytes
    const view = new DataView(buffer);

    view.setUint8(0, byte0);
    view.setUint8(1, byte1);
    view.setUint8(2, byte2);
    view.setUint8(3, byte3);

    return view.getUint32(0, true);
}

export function getPaddedUint32(number: number) {
    const buffer = new ArrayBuffer(4); // 4 bytes in uint32
    const view = new DataView(buffer);
    view.setUint32(0, number, true);
    return new Uint8Array(buffer); // Convert the buffer to a Uint8Array and return it
}

export function decodeBytesToJSON(input: Uint8Array, offset: number, length: number) {
    let result;
    const subArray = input.subarray(offset, offset + length);
    const decoder = new TextDecoder();
    result = JSON.parse(decoder.decode(subArray));
    return result;
}

export function hasAllKeys<T>(obj: any, keys: Array<keyof T>): obj is T {
    return keys.every(key => key in obj);
}

export function ReplaceFileExtension(fileName: string, newExtension: string) {
    const pathSplit = fileName.split(".");
    if(pathSplit.length === 1) {
        // No extension, new default
        return `${fileName}.${newExtension}`;
    } else {
        return `${pathSplit[0]}.${newExtension}`;
    }
}