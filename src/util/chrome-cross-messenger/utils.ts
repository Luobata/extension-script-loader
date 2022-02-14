export enum ScriptType {
    Background = 'BACKGROUND',
    Popup = 'POPUP',
    Web = 'WEB',
    Content = 'CONTENT',
}

export const genID = (length = 10): string => {
    return Math.random()
        .toString(36)
        .substr(2, length + 2);
};

export const getScriptType = (): ScriptType => {
    if (chrome && chrome.extension && chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window) {
        return ScriptType.Background;
    } else if (chrome && chrome.extension && chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() !== window) {
        return ScriptType.Popup;
    } else if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) {
        return ScriptType.Web;
    } else {
        return ScriptType.Content;
    }
};
