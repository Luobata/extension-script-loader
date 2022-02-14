/**
 * @desc 解析content-sciprt
 */
import Parser from './Parser';

export type contentConfig = {
    matches: string[];
    exclude_matches: string[];
    allFrames: boolean;
    iframe_only: boolean;
    runAt: 'document_start' | 'document_end' | 'document_idle';
    srcUrl: string;
};

export default class ContentParser extends Parser {
    private _url: string;
    private _conf: contentConfig;

    constructor(
        srcCode: string,
        srcKey: string,
        sender: chrome.runtime.MessageSender,
        conf: contentConfig = {
            matches: [],
            exclude_matches: [],
            allFrames: true,
            iframe_only: false,
            runAt: 'document_start',
            srcUrl: '',
        },
    ) {
        const code = `
                 (function(global_content_key){
                     ${srcCode}
                 })("${srcKey}");
             `;

        super(code);

        this._conf = conf;
        this._url = sender.url;
        this._load(sender);
    }
    public static needLoad(
        url,
        match: contentConfig['matches'],
        exclude: contentConfig['exclude_matches'],
    ): boolean {
        let need = false;

        for (let i: number = 0; i < exclude.length; i++) {
            if (url.match(exclude[i])) {
                return need;
            }
        }

        for (let i: number = 0; i < match.length; i++) {
            if (url.match(match[i])) {
                need = true;

                return need;
            }
        }

        return need;
    }

    // 销毁
    public destroy(): void {
        // TODO content暂时不需要销毁什么只需要下次load是新的就可以了
    }

    private _needLoad(): boolean {
        return ContentParser.needLoad(
            this._url,
            this._conf.matches,
            this._conf.exclude_matches,
        );
    }

    private _load(
        sender: chrome.runtime.MessageSender,
        // data: { detail: chrome.tabs.InjectDetails; fileType: string },
    ): void {
        // TODO 这个api是否需要劫持 如果没有则需要

        // TODO 如果有必要，此时可以注入tabid
        // 判断是否是matches 或者 exclude_matches
        // if (data.fileType === 'js') {
        chrome.tabs.executeScript(sender.tab.id, {
            frameId: sender.frameId,
            code: this._originCode,
            allFrames: this._conf.allFrames,
            runAt: this._conf.runAt,
        });
        // } else if (data.fileType === 'css') {
        //     chrome.tabs.insertCSS(sender.tab.id, {
        //         frameId: sender.frameId,
        //         code: this._originCode,
        //         allFrames: data.detail.allFrames,
        //         runAt: data.detail.runAt,
        //     });
        // }
    }
}
