/**
 * @desc 声明一个全局的contentGlobal扩展
 */

const contentGlobalMessageBridgeStr = '__contentGlobalMessageBridgeStr';
export const contentGlobalMessageBridgeEventStr =
    '__contentGlobalMessageBridgeEventStr';

const contentGlobal = {
    insertCode: (keyobj: any, ...params: any[]): void => {
        const key = typeof keyobj === 'string' ? keyobj : keyobj.toString();
        const script = document.createElement('script');
        const paramsStr = params
            .map((v) => {
                // TODO 其他类型
                if (typeof v === 'string') {
                    return `"${v}"`;
                } else if (typeof v === 'number') {
                    return v;
                } else {
                    throw new Error('inject code not support object type');
                }
            })
            .join(',');
        // script.textContent = ';(' + key + ')(' + paramsStr + ')';
        script.text = ';(' + key + ')(' + paramsStr + ')';
        // script.textContent = `;(
        //         ${key}
        //     )(${paramsStr})`;
        document.documentElement.appendChild(script);
        // script.parentNode.removeChild(script);
    },

    // 增加一个全局callback
    addListnener: (key: string, cb: Function): void => {
        window.addEventListener('message', (data) => {
            const bridgeData = data.data;
            if (bridgeData?.type === contentGlobalMessageBridgeEventStr) {
                if (bridgeData?.obj.eventKey === key) {
                    cb(bridgeData?.obj?.data);
                }
            }
        });
    },

    triggerListener: (key: string, data: Object): void => {
        window.postMessage(
            {
                type: contentGlobalMessageBridgeEventStr,
                obj: {
                    eventKey: key,
                    data,
                },
            },
            '*',
        );
    },

    // 这个设计只能从widnow拿如果不在window就获取不了
    getInjectVar: async (...key: string[]): Promise<any> => {
        const getCode = (bridgeKey: string, ...key: string[]) => {
            let o = window;
            key.forEach((v) => {
                o = o[v];
            });
            window.postMessage(
                {
                    type: bridgeKey,
                    obj: o,
                },
                '*',
            );
        };
        contentGlobal.insertCode(
            getCode,
            contentGlobalMessageBridgeStr,
            ...key,
        );

        // TODO 这个有更好的写法么
        return new Promise((resolve, reject) => {
            const cbFn = (data: MessageEvent) => {
                const bridgeData = data.data;
                if (bridgeData?.type === contentGlobalMessageBridgeStr) {
                    resolve(bridgeData.obj);
                    window.removeEventListener('message', cbFn);
                }
            };
            window.addEventListener('message', cbFn);
        });
    },
};

window.contentGlobal = contentGlobal;
// window.contentLogger = logger();

export default contentGlobal;
