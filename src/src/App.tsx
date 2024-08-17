import { useState } from "react";
import "./App.css";
import { PackagingEditor } from "./components/PackagingEditor";
import { TabbedView } from "./components/TabbedView";
import { UserEditor } from "./components/UserEditor";
import { User } from "./interfaces/User";
import { ContactsEditor } from "./components/ContactsEditor";
import { Contact } from "./interfaces/Contact";

function App() {
  const [userProfile, setUserProfile] = useState<User>();

  const manageProfileView = <UserEditor user={userProfile} updateUser={setUserProfile}></UserEditor>;
  const packageFileView = <PackagingEditor user={userProfile}></PackagingEditor>
  const contactsView = <ContactsEditor user={userProfile} updateContacts={(newContacts: Contact[]) => {
    setUserProfile((prevUser) => {
      if (prevUser) {
        prevUser.contacts = newContacts;
        return prevUser;
      }
    })
  }}></ContactsEditor>

  let userName = userProfile ? userProfile.name : "Log in"
  const contextIcon = <button>{userName}</button>

  return (
    <div className="container">
      <TabbedView
        tabs={["Package Files", "Manage Profile", "Contacts"]}
        tabViews={[
          packageFileView,
          manageProfileView,
          contactsView
        ]}
        contextIcon={contextIcon}
        pressIconSetsTabToIdx={1}
      />
    </div>
  );
}

export default App;
