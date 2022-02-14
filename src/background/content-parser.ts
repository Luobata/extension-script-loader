/**
 * @desc 解析content-sciprt
 */
import Parser from './Parser';

export default class ContentParser extends Parser {
    private _url: string;

    constructor(
        srcCode: string,
        srcKey: string,
        sender: chrome.runtime.MessageSender,
        data: any,
    ) {
        const code = `
                 (function(global_content_key){
                     ${srcCode}
                 })("${srcKey}");
             `;

        super(code);

        this._url = sender.url;
        this._load(sender, data);
    }

    // 销毁
    public destroy(): void {
        // TODO content暂时不需要销毁什么只需要下次load是新的就可以了
    }

    private _needLoad(): boolean {
        // const exclude = this._conf.exclude_matches;
        // const match = this._conf.matches;

        const exclude = ['http://*/*', 'https://*/*'];
        const match = [];

        let need = false;

        for (let i: number = 0; i < exclude.length; i++) {
            if (this._url.match(exclude[i])) {
                return need;
            }
        }

        for (let i: number = 0; i < match.length; i++) {
            if (this._url.match(match[i])) {
                need = true;

                return need;
            }
        }

        return need;
    }

    private _load(
        sender: chrome.runtime.MessageSender,
        data: { detail: chrome.tabs.InjectDetails; fileType: string },
    ): void {
        // TODO 这个api是否需要劫持 如果没有则需要

        // TODO 如果有必要，此时可以注入tabid
        // 判断是否是matches 或者 exclude_matches
        if (this._needLoad()) {
            if (data.fileType === 'js') {
                chrome.tabs.executeScript(sender.tab.id, {
                    frameId: sender.frameId,
                    code: this._originCode,
                    allFrames: data.detail.allFrames,
                    runAt: data.detail.runAt,
                });
            } else if (data.fileType === 'css') {
                chrome.tabs.insertCSS(sender.tab.id, {
                    frameId: sender.frameId,
                    code: this._originCode,
                    allFrames: data.detail.allFrames,
                    runAt: data.detail.runAt,
                });
            }
        }
    }
}
