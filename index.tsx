import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Menu, React } from "@webpack/common";

const MediaEngineActions = findByPropsLazy("toggleSelfMute");
const SelectedChannelStore = findStoreLazy("SelectedChannelStore");

function KeybindRecorder({ setValue, option }: { setValue: (v: string) => void; option: { default?: string; }; }) {
    const [recording, setRecording] = React.useState(false);
    const [keybind, setKeybind] = React.useState(settings.store.keybind || "");

    React.useEffect(() => {
        if (!recording) return;

        function onKeyDown(e: KeyboardEvent) {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === "Escape") {
                setRecording(false);
                return;
            }

            if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

            const parts: string[] = [];
            if (e.ctrlKey) parts.push("Ctrl");
            if (e.shiftKey) parts.push("Shift");
            if (e.altKey) parts.push("Alt");
            parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

            const combo = parts.join("+");
            setKeybind(combo);
            setValue(combo);
            setRecording(false);
        }

        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [recording]);

    return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
                onClick={() => setRecording(!recording)}
                style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    background: recording ? "#ed4245" : "#5865f2",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: "14px",
                    minWidth: "180px"
                }}
            >
                {recording ? "Press a key combo..." : keybind || "Click to set keybind"}
            </button>
            {keybind && !recording && (
                <button
                    onClick={() => {
                        setKeybind("");
                        setValue("");
                    }}
                    style={{
                        padding: "8px 12px",
                        borderRadius: "4px",
                        border: "none",
                        background: "#4f545c",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "14px"
                    }}
                >
                    Clear
                </button>
            )}
        </div>
    );
}

const settings = definePluginSettings({
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        description: "Fake Deafen",
        default: false,
        hidden: true,
    },
    keybind: {
        type: OptionType.COMPONENT,
        description: "Keybind to toggle Fake Deafen",
        component: (props) => <KeybindRecorder {...props} />
    }
});

function isInVoiceChannel(): boolean {
    try {
        return !!SelectedChannelStore.getVoiceChannelId();
    } catch {
        return false;
    }
}

function toggleFakeDeafen() {
    settings.store.fakeDeafen = !settings.store.fakeDeafen;
    try {
        MediaEngineActions.toggleSelfDeaf();
        setTimeout(() => {
            try { MediaEngineActions.toggleSelfDeaf(); } catch { }
        }, 50);
    } catch { }
}

function parseKeybind(keybind: string) {
    if (!keybind) return null;

    const parts = keybind.split("+").map(p => p.trim());
    const key = parts.pop()!;
    const modifiers = {
        ctrl: parts.includes("Ctrl"),
        shift: parts.includes("Shift"),
        alt: parts.includes("Alt"),
    };

    return { key, ...modifiers };
}

function handleKeyDown(e: KeyboardEvent) {
    const kb = parseKeybind(settings.store.keybind);
    if (!kb) return;

    if (
        e.key.toLowerCase() === kb.key.toLowerCase() &&
        e.ctrlKey === kb.ctrl &&
        e.shiftKey === kb.shift &&
        e.altKey === kb.alt
    ) {
        e.preventDefault();
        if (!isInVoiceChannel()) return;
        toggleFakeDeafen();
    }
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Fake your deafen status to others.",
    authors: [{ id: 1449096170646536233n, name: "Block" }],
    settings,

    patches: [
        {
            find: ".setSelfMute(this.selfMute",
            replacement: [
                {
                    match: /\.setSelfDeafen\((.+?)\)/g,
                    replace: ".setSelfDeafen($self.isFakeDeafen()?false:$1)"
                }
            ]
        }
    ],

    contextMenus: {
        "audio-device-context"(children) {
            children.push(
                <Menu.MenuSeparator />,
                <Menu.MenuCheckboxItem
                    id="vc-fake-deafen"
                    label="Fake Deafen"
                    checked={settings.store.fakeDeafen}
                    disabled={!isInVoiceChannel()}
                    action={toggleFakeDeafen}
                />
            );
        }
    },

    start() {
        document.addEventListener("keydown", handleKeyDown);
    },

    stop() {
        document.removeEventListener("keydown", handleKeyDown);
    },

    isFakeDeafen() {
        return settings.store.fakeDeafen;
    }
});
