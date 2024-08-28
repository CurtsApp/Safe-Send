import { useState } from "react";

interface SideBarViewProps {
    tabs: string[];
    tabViews: (JSX.Element | undefined)[];
    contextIcon?: JSX.Element;
    pressIconSetsTabToIdx?: number;
    initalTabIdx?: number;
    lockToTab?: number;
}

export function SideBarView(props: SideBarViewProps) {
    const [selTabIdxState, setSelTabIdx] = useState(props.initalTabIdx === undefined ? 0 : props.initalTabIdx);

    const isTabLocked = props.lockToTab !== undefined;
    let selTabIdx = props.lockToTab !== undefined ? props.lockToTab : selTabIdxState;

    return (
        <div className="sidebarViewContainer">
            <div className="sidebar">
                <div className="column">
                    <div onClick={() => props.pressIconSetsTabToIdx !== undefined ? setSelTabIdx(props.pressIconSetsTabToIdx) : null}>
                        {props.contextIcon}
                    </div>
                    {getTabs()}
                </div>
            </div>
            <div className="sidebarView">
                {props.tabViews[selTabIdx]}
            </div>
        </div>
    )

    function getTabs() {
        return props.tabs.map((tab, idx) => {
            return (
                <div id={tab} className={`${idx === selTabIdx ? "selected" : undefined} ${isTabLocked ? "disabled" : "interactiveText"}`} onClick={() => {
                    if(!isTabLocked) {
                        setSelTabIdx(idx)
                    }                    
                }}>
                    {tab}
                </div>
            )
        })
    }
}