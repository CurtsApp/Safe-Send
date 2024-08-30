
interface SideBarViewProps {
    tabs: string[];
    tabViews: (JSX.Element | undefined)[];
    contextIcon?: JSX.Element;
    pressIconSetsTabToIdx?: number;
    selTabIdx: number;
    lockToTab?: boolean;

    setSelTabIdx: (newTabIdx: number) => void;
}

export function SideBarView(props: SideBarViewProps) {  
    const isTabLocked = props.lockToTab !== undefined && props.lockToTab;

    return (
        <div className="sidebarViewContainer">
            <div className="sidebar">
                <div className="column">
                    <div onClick={() => props.pressIconSetsTabToIdx !== undefined && !isTabLocked ? props.setSelTabIdx(props.pressIconSetsTabToIdx) : null}>
                        {props.contextIcon}
                    </div>
                    {getTabs()}
                </div>
            </div>
            <div className="sidebarView">
                {props.tabViews[props.selTabIdx]}
            </div>
        </div>
    )

    function getTabs() {
        return props.tabs.map((tab, idx) => {
            return (
                <div key={idx} id={tab} className={`${idx === props.selTabIdx ? "selected" : undefined} ${isTabLocked ? "disabled" : "interactiveText"}`} onClick={() => {
                    if(!isTabLocked) {
                        props.setSelTabIdx(idx)
                    }                    
                }}>
                    {tab}
                </div>
            )
        })
    }
}