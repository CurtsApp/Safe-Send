import { useState } from "react";

interface TabbedViewProps {
    tabs: string[];
    tabViews: (JSX.Element | undefined)[];
    contextIcon?: JSX.Element;
    pressIconSetsTabToIdx?: number;
}

export function TabbedView(props: TabbedViewProps) {
    const [selTabIdx, setSelTabIdx] = useState(0);

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
                <div id={tab} className={idx === selTabIdx ? "selected" : undefined} onClick={() => setSelTabIdx(idx)}>
                    {tab}
                </div>
            )
        })
    }
}