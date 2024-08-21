import { ask, message, open, save } from "@tauri-apps/api/dialog";
import { Contact } from "../interfaces/Contact";
import { User } from "../interfaces/User";
import { ExportContact, GetContactFromPath } from "../utils/contact_utils";
import { getFirstString, stringSort } from "../utils/general_utils";
import { GetContactFromUser } from "../utils/user_utils";

interface ContactsEditorProps {
    user: User | undefined;
    updateContacts: (newContacts: Contact[]) => void;
}

export function ContactsEditor(props: ContactsEditorProps) {
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
        const path = await save({ defaultPath: contact.name, title: "Export My Contact", filters: [{ extensions: ["ssc"], name: "Safe Send Contact" }] });
        if (path) {
            ExportContact(contact, path);
        }
    };

    return (
        <div className="column">
            <div className="row">
                <button onClick={handleImportContact}>Import Contact</button>
                <button onClick={() => props.user ? handleExportContact(GetContactFromUser(props.user)) : undefined}>Export My Contact</button>
            </div>

            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {contacts.map((contact, idx) => (
                    <li key={`${contact.name}.${contact.note}`} className="column outlineContainer">
                        <label>
                            Name:
                            <input
                                type="text"
                                value={contact.name}
                                onChange={(e) => handleUpdateContact(idx, 'name', e.target.value)}
                            />
                        </label>
                        <label>
                            Note:
                            <input
                                type="text"
                                value={contact.note}
                                onChange={(e) => handleUpdateContact(idx, 'note', e.target.value)}
                            />
                        </label>

                        <div className="row">
                            <button onClick={() => handleExportContact(contacts[idx])}>
                                Export
                            </button>
                            <button className="danger" onClick={() => handleDeleteContact(idx)}>
                                Delete
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );

}