import { open, save } from "@tauri-apps/api/dialog";
import { writeBinaryFile } from "@tauri-apps/api/fs";
import { sep } from "@tauri-apps/api/path";
import { useState } from "react";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { DecryptFile } from "../utils/crypto_utils";
import { EFFormat } from "../utils/key_utils";
import { LabeledOutlineContainer } from "./LabeledOutlineContainer";
import { GetContactFromUser } from "../utils/user_utils";

interface DecryptEditorProps {
    user: User | undefined,
}

export function DecryptEditor(props: DecryptEditorProps) {
    const [inputFiles, setInputFiles] = useState<string[]>([]);
    const [selectedContact, setselectedContact] = useState<number | undefined>(undefined);

    const noFilesSelected = !inputFiles || inputFiles.length === 0;
    const noContactSelected = selectedContact === undefined;

    const decryptSelFiles = () => {
        if (noFilesSelected || !props.user?.encryptionKeys) {
            return;
        }

        inputFiles.forEach(async file => {
            if (props.user && selectedContact !== undefined) {
                let contactsToDecryptFor = props.user.contacts[selectedContact]

                DecryptFile(EFFormat.V0, file, contactsToDecryptFor, props.user).then(async (fileDetails) => {
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
            return <li>No files selected</li>
        }

        return (
            Array.from(inputFiles).map(file => (<li id={file}>{file}</li>))
        );
    }

    const getContactList = () => {
        if (props.user === undefined) {
            return;
        }

        const allContacts = [GetContactFromUser(props.user)];
        allContacts[0].name = `${allContacts[0].name} (Me)`
        allContacts.push(...props.user.contacts);

        return (
            <ul>
                {Array.from(allContacts).map((contact, idx) => (
                    <li id={`${contact.name}-${contact.note}`}>
                        <ContactRow
                            contact={contact}
                            isSelected={selectedContact === idx}
                            setSelected={(newSelection) => {
                                if (newSelection) {
                                    setselectedContact(idx);
                                } else {
                                    setselectedContact(undefined);
                                }
                            }}
                        />
                    </li>))}
            </ul>
        )
    }

    return (
        <div className="column" style={{ width: "100%" }}>
            <LabeledOutlineContainer label="Selected Files" fitContentWidth={false}>
                <div className="column">
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
                    }}>Browse</button>
                </div>
            </LabeledOutlineContainer>
            <div className="column" style={{ width: "100%" }}>
                <LabeledOutlineContainer label="Expected File Sender">
                    {getContactList()}
                </LabeledOutlineContainer>
            </div>
            <div className="row">
                <button onClick={() => decryptSelFiles()} disabled={noFilesSelected || noContactSelected}>Decrypt</button>
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
        <div className="row interactive" style={{ justifyContent: "space-between" }} onClick={() => {
            props.setSelected(!props.isSelected)
        }}>
            <div className="column">
                <div>{props.contact.name}</div>
                {props.contact.note !== undefined && props.contact.note.trim() !== "" ? <div><i>props.contact.note</i></div> : undefined}
            </div>
            <div>
                <input type="checkbox" checked={props.isSelected}></input>
            </div>
        </div>
    )
}