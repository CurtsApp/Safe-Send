import { useState } from "react";

interface TabbedViewProps {
    tabs: string[];
    tabViews: (JSX.Element | undefined)[];
    contextIcon?: JSX.Element;
    pressIconSetsTabToIdx?: number;
    initalTabIdx?: number;
    lockToTab?: number;
}

export function TabbedView(props: TabbedViewProps) {
    const [selTabIdxState, setSelTabIdx] = useState(props.initalTabIdx === undefined ? 0 : props.initalTabIdx );

    const isTabLocked = props.lockToTab !== undefined;
    let selTabIdx = props.lockToTab !== undefined ? props.lockToTab : selTabIdxState;

    return (
        <div className="column">
            <div className="row" style={{justifyContent: "space-between"}}>
                <div className="tabcontrol">
                    {getTabs()}
                </div>
                <div onClick={() => props.pressIconSetsTabToIdx !== undefined ? setSelTabIdx(props.pressIconSetsTabToIdx) : null}>
                    {props.contextIcon}
                </div>

            </div>

            <div className="tabcontent">
                {props.tabViews[selTabIdx]}
            </div>
        </div>
    )

    function getTabs() {
        return props.tabs.map((tab, idx) => {
            return (
                <div id={tab} className={`${idx === selTabIdx ? "selected" : undefined} ${isTabLocked ? "disabled" : null}`} onClick={() => setSelTabIdx(idx)}>
                    {tab}
                </div>
            )
        })
    }
}