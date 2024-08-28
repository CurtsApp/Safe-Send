import { useState } from "react";
import "./App.css";
import { PackagingEditor } from "./components/PackagingEditor";
import { TabbedView } from "./components/TabbedView";
import { UserEditor } from "./components/UserEditor";
import { User } from "./interfaces/User";
import { ContactsEditor } from "./components/ContactsEditor";
import { Contact } from "./interfaces/Contact";
import { GetUserProfilePath, SaveUser, USER_PROFILE_BASE_DIR, VerifyUserProfilesDirectoryExists } from "./utils/user_utils";
import { renameFile } from "@tauri-apps/api/fs";
import { DecryptEditor } from "./components/DecryptEditor";
import { SideBarView } from "./components/SideBarView";

function App() {
  const [userProfile, setUserProfile] = useState<User>();

  const updateUser = (newUser: User | undefined) => {
    if (newUser === undefined) {
      setUserProfile(undefined);
      return;
    }
    VerifyUserProfilesDirectoryExists().then(() => {
      // Default to "old" username, if none then use provided name. This allows the creation of new user profiles.
      let userFileName = userProfile === undefined ? newUser.name : userProfile.name;
      // Save first using potentially old file name
      SaveUser(newUser, GetUserProfilePath(userFileName), USER_PROFILE_BASE_DIR).then(() => {
        if (userProfile && newUser.name !== userProfile.name) {
          // Rename stored file
          // TODO handle file name collision, don't DELETE ANYONES KEYS
          renameFile(GetUserProfilePath(userProfile.name), GetUserProfilePath(newUser.name), USER_PROFILE_BASE_DIR);
        }
      });

      setUserProfile({ ...newUser });
    });
  }

  const manageProfileView = <UserEditor user={userProfile} updateUser={updateUser}></UserEditor>;
  const packageFileView = <PackagingEditor user={userProfile}></PackagingEditor>
  const decryptFileView = <DecryptEditor user={userProfile}></DecryptEditor>
  const contactsView = <ContactsEditor user={userProfile} updateContacts={(newContacts: Contact[]) => {
    if (userProfile !== undefined) {
      updateUser({ ...userProfile, contacts: newContacts });
    }
  }}></ContactsEditor>

  let userName = userProfile ? userProfile.name : "Log in"
  const contextIcon = <div className="interactiveText" style={{width: "100%", justifyContent: "center"}}>{userName}</div>

  return (
    <SideBarView
        tabs={["Encrypt", "Decrypt", "My Profile", "Contacts"]}
        tabViews={[
          packageFileView,
          decryptFileView,
          manageProfileView,
          contactsView
        ]}
        contextIcon={contextIcon}
        pressIconSetsTabToIdx={2}
        initalTabIdx={2}
        lockToTab={userProfile === undefined ? 2 : undefined}
      />
  );
}

export default App;
