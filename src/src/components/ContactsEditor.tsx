import { ask, message, open, save } from "@tauri-apps/api/dialog";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { ExportContact, GetContactFromPath } from "../utils/contact_utils";
import { getFirstString, stringSort } from "../utils/general_utils";
import { GetContactFromUser } from "../utils/user_utils";
import { LabeledOutlineContainer } from "./LabeledOutlineContainer";
import { LabeledInputField } from "./LabeledInputField";
import { useState } from "react";

interface ContactsEditorProps {
    user: User | undefined;
    updateContacts: (newContacts: Contact[]) => void;
}

export function ContactsEditor(props: ContactsEditorProps) {
    const [searchQuery, setSearchQuery] = useState("");

    if (!props.user) {
        return <div>Please log in</div>;
    }

    // Updating the user will trigger re-render, so this isn't state
    let contacts = [...props.user.contacts];

    const handleDeleteContact = (listIdx: number) => {
        ask(`Are you sure you want to delete '${contacts[listIdx].name}'?`,
            { okLabel: "Delete Contact", cancelLabel: "Cancel", title: `Delete ${contacts[listIdx].name}` })
            .then(confirmed => {
                if (confirmed) {
                    contacts.splice(listIdx, 1)
                    props.updateContacts(contacts);
                }
            });
    };

    const handleUpdateContact = (listIdx: number, key: keyof Contact, value: string) => {
        contacts[listIdx] = { ...contacts[listIdx], [key]: value };
        props.updateContacts(contacts);
    };

    const handleImportContact = async () => {
        const selected = await open({ title: "Import Contact", filters: [{ extensions: ["ssc"], name: "Safe Send Contact" }] });
        let path = getFirstString(selected);
        if (path) {
            GetContactFromPath(path).then(newContact => {
                contacts.push(newContact);
                contacts.sort((a, b) => {
                    return stringSort(a.name, b.name);
                })
                props.updateContacts(contacts);
            }).catch(() => message(`Failed to import contact: ${path}`))
        }
    };

    const handleExportContact = async (contact: Contact) => {
        const path = await save({ defaultPath: contact.name, title: "Share My Contact", filters: [{ extensions: ["ssc"], name: "Safe Send Contact" }] });
        if (path) {
            ExportContact(contact, path);
        }
    };

    let visibleContacts = contacts.filter((contact) => {
        let query = searchQuery.trim();
        if (query === "") {
            return true;
        }
        return contact.name.includes(query) || contact.note?.includes(query);
    })

    return (
        <div className="column fillWidth" style={{justifyContent: "space-evenly"}}>
            <div className="row centered">
                <button onClick={handleImportContact}>Add Contact</button>
                <button onClick={() => props.user ? handleExportContact(GetContactFromUser(props.user)) : undefined}>Share My Contact</button>
            </div>
            <div className="centered">
                <LabeledOutlineContainer label={"Contacts"}>
                    <div className="column">
                        <div style={{ marginLeft: "0.6em" }}>
                            <LabeledInputField
                                label={"Search"}
                                fieldValue={searchQuery}
                                updateStringValue={(updatedValue) => setSearchQuery(updatedValue)} />
                        </div>
                        {visibleContacts.length === 0 ?
                            <div>No contacts found</div>
                            : <ul className="row" style={{ listStyleType: 'none', padding: 0, flexWrap: "wrap", rowGap: "0.6em" }}>
                                {visibleContacts.map((contact, idx) => (
                                    <li key={`${contact.name}.${contact.note}.${idx}`} className="column outlineContainer">
                                        <LabeledInputField
                                            label={"Name"}
                                            fieldValue={contact.name}
                                            updateStringValue={(updatedValue) => handleUpdateContact(idx, 'name', updatedValue)} />
                                        <LabeledInputField
                                            label={"Note"}
                                            fieldValue={contact.note || ""}
                                            updateStringValue={(updatedValue) => handleUpdateContact(idx, 'note', updatedValue)} />
                                        <div className="row">
                                            <button onClick={() => handleExportContact(contacts[idx])}>
                                                Share
                                            </button>
                                            <button className="danger" onClick={() => handleDeleteContact(idx)}>
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>}
                    </div>
                </LabeledOutlineContainer>
            </div>

        </div>
    );

}