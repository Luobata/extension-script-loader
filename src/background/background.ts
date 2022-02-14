/**
 * @desc background index
 */

import ChromeCrossMessenger from 'SRC/util/chrome-cross-messenger/chrome-cross-messenger';
import { loadRemoteContent } from 'SRC/util/const';
import ContentParser, { contentConfig } from './content-parser';
import InjectParser from './inject-parser';
import scriptLoader from './load';

console.log('test');

const testConf: contentConfig[] = [
    {
        // TODO srcURL是否可以支持本地文件
        srcUrl: 'http://127.0.0.1:8000/js/mock.js',
        matches: ['http://*/*', 'https://*/*'],
        allFrames: true,
        iframe_only: false,
        runAt: 'document_start',
        exclude_matches: [],
    },
];

// 用来生成不唯一的content key 用来通信，可以先忽略这个变量
let id: number = 1;

export default class Background {
    private _corss: ChromeCrossMessenger;
    private _loadingData: Map<string, { conf: contentConfig; code: string }> =
        new Map();

    constructor() {
        this._corss = ChromeCrossMessenger.getInstance();

        this._load();
        this._listener();
    }

    private _load(): void {
        // 正常与popup通信获取，即local
        const confs: contentConfig[] = testConf;

        confs.forEach(async (v) => {
            const data = await scriptLoader.fetchCodeInner(v.srcUrl);

            this._loadingData.set(v.srcUrl, {
                conf: v,
                code: data,
            });
            console.log(this._loadingData);
        });
    }

    private _listener(): void {
        this._corss.on(loadRemoteContent, (data, { sender }) => {
            console.log(data, sender);
            const tabUrl = sender.url;
            this._loadingData.forEach((v) => {
                if (
                    ContentParser.needLoad(
                        tabUrl,
                        v.conf.matches,
                        v.conf.exclude_matches,
                    )
                ) {
                    new InjectParser(v.code, `${id++}`, sender, v.conf);
                }
            });
        });
    }
}

new Background();
