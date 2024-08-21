import { open, save } from "@tauri-apps/api/dialog";
import { writeBinaryFile } from "@tauri-apps/api/fs";
import { sep } from "@tauri-apps/api/path";
import { useState } from "react";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { DecryptFile, EncryptFile } from "../utils/crypto_utils";
import { EFFormat } from "../utils/key_utils";

interface PackagingEditorProps {
    user: User | undefined,
}

export function PackagingEditor(props: PackagingEditorProps) {
    const [inputFiles, setInputFiles] = useState<string[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

    const noFilesSelected = !inputFiles || inputFiles.length === 0;

    const encryptSelFiles = async () => {
        if (noFilesSelected || !props.user?.encryptionKeys) {
            return;
        }

        const path = await save({
            filters: [
                {
                    name: 'Safe File',
                    extensions: ["ef"],
                },
            ],
            title: "Output File"
        });

        if (props.user && path) {
            // @ts-ignore
            let contactsToEncryptFor = selectedContacts.map(selIdx => props.user.contacts[selIdx]);
            contactsToEncryptFor = contactsToEncryptFor.filter(contact => contact !== undefined);
            EncryptFile(EFFormat.V0, inputFiles[0], path, contactsToEncryptFor, props.user);
        }
    }

    const decryptSelFiles = () => {
        if (noFilesSelected || !props.user?.encryptionKeys) {
            return;
        }

        inputFiles.forEach(async file => {
            if (props.user) {
                // @ts-ignore
                let contactsToDecryptFor = selectedContacts.map(selIdx => props.user.contacts[selIdx]);
                contactsToDecryptFor = contactsToDecryptFor.filter(contact => contact !== undefined);

                DecryptFile(EFFormat.V0, file, contactsToDecryptFor[0], props.user).then(async (fileDetails) => {
                    let splitPath = file.split(sep);
                    // Remove file name
                    splitPath = splitPath.splice(-1);
                    // Add new file name
                    splitPath.push(fileDetails.fileName);
                    const pathToNewFile = splitPath.join(sep);

                    const path = await save({
                        title: `Decrypting ${file}`,
                        defaultPath: pathToNewFile
                    });

                    if (path) {
                        writeBinaryFile(path, fileDetails.decryptedFile);
                    }

                }).catch(reason => {
                    // TODO handle failing to decrypt file
                })
            }
        });

    }

    const getFileList = () => {
        if (noFilesSelected) {
            return;
        }

        return (
            Array.from(inputFiles).map(file => (<li id={file}>{file}</li>))
        );
    }

    const getContactList = () => {
        if (props.user === undefined || props.user.contacts.length === 0) {
            return;
        }

        return (
            <ul>
                {Array.from(props.user.contacts).map((contact, idx) => (
                    <li id={`${contact.name}-${contact.note}`}>
                        <ContactRow
                            contact={contact}
                            isSelected={selectedContacts.find((contactIdx) => contactIdx === idx) !== undefined}
                            setSelected={(newSelection) => {
                                if (newSelection) {
                                    selectedContacts.push(idx);
                                    setSelectedContacts([...selectedContacts]);
                                } else {
                                    let idxToRemove = selectedContacts.findIndex((contactIdx) => contactIdx === idx);
                                    selectedContacts.splice(idxToRemove, 1);
                                    setSelectedContacts([...selectedContacts]);
                                }
                            }}
                        />
                    </li>))}
            </ul>
        )
    }

    return (
        <div className="column" style={{ width: "100%" }}>
            <div className="column outlineContainer">
                <ul style={{ minHeight: "100px" }}>
                    {getFileList()}
                </ul>
                <button onClick={async () => {
                    const selected = await open({
                        multiple: true
                    });

                    if (Array.isArray(selected)) {
                        // user selected multiple files
                        setInputFiles(selected);
                    } else if (selected === null) {
                        // user cancelled the selection
                        setInputFiles([]);
                    } else {
                        // user selected a single file
                        setInputFiles([selected]);
                    }
                }}>Select Files</button>
            </div>

            <div className="row">
                <button onClick={() => encryptSelFiles()} disabled={noFilesSelected}>Encrypt</button>
                <button onClick={() => decryptSelFiles()} disabled={noFilesSelected}>Decrypt</button>
            </div>
            <div className="outlineContainer">
                <div>Contacts to encrypt for</div>
                {getContactList()}
            </div>

        </div>
    );
}

interface ContactRowProps {
    contact: Contact;
    isSelected: boolean;
    setSelected: (isSelected: boolean) => void;
}

function ContactRow(props: ContactRowProps) {
    return (
        <div className="row">
            <div className="column">
                <div>{props.contact.name}</div>
                {props.contact.note !== undefined && props.contact.note.trim() !== "" ? <div><i>props.contact.note</i></div> : undefined}
            </div>
            <div>
                <input type="checkbox" checked={props.isSelected} onChange={() => props.setSelected(!props.isSelected)}></input>
            </div>
        </div>
    )
}