import { open, save } from "@tauri-apps/api/dialog";
import { useState } from "react";
import { User } from "../interfaces/User";
import { DecryptFile, EncryptFile, SignFile, VerifyFile } from "../utils/crypto_utils";
import { Contact } from "../interfaces/Contact";

interface PackagingEditorProps {
    user: User | undefined,
}

export function PackagingEditor(props: PackagingEditorProps) {
    const [inputFiles, setInputFiles] = useState<string[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

    const noFilesSelected = !inputFiles || inputFiles.length === 0;
    const signSelFiles = async () => {
        if (noFilesSelected || !props.user?.signingKeys) {
            return;
        }

        const path = await save({
            filters: [
                {
                    name: 'Signed File',
                    extensions: ["sf"],
                },
            ],
            title: "Output File"
        });

        if (path) {
            SignFile(inputFiles[0], path, props.user.signingKeys.privateKey)
        }
    }

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

        if (path) {
            // @ts-ignore
            let contactsToEncryptFor = selectedContacts.map(selIdx => props.user.contacts[selIdx]);
            contactsToEncryptFor = contactsToEncryptFor.filter(contact => contact !== undefined);
            EncryptFile(inputFiles[0], path, contactsToEncryptFor);
        }
    }

    const decryptSelFiles = () => {
        if (noFilesSelected || !props.user?.encryptionKeys) {
            return;
        }

        inputFiles.forEach(async file => {
            const path = await save({
                title: file,
                defaultPath: file
            });

            if (path && props.user) {
                // @ts-ignore
                let contactsToDecryptFor = selectedContacts.map(selIdx => props.user.contacts[selIdx]);
                DecryptFile(file, path, contactsToDecryptFor[0], props.user)
            }
        });

    }

    const verifySelFiles = async () => {
        if (!props.user?.encryptionKeys) {
            return;
        }

        const path = await open({
            filters: [
                {
                    name: 'Signed File',
                    extensions: ["sf"],
                },
            ],
            title: "Verify File"
        });

        if (path) {
            if (Array.isArray(path)) {
                // TODO verify multiple files at the same time
                //VerifyFile(path[0], props.user.signingKeys.publicKey).then(res => setSuc(res))
            } else {
                //VerifyFile(path, props.user.signingKeys.publicKey).then(res => setSuc(res))
            }
        }
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