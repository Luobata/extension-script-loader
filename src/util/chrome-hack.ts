/**
 * @desc hack全量chrome api 需要针对不同环境做api补全
 */

export function getProxy() {
    return new Proxy(window.chrome, {
        get: (obj, prop) => {
            // 在这里进行分流 对electron中的部分api做劫持
            return obj[prop];
        },
    });
}

export function hackChrome() {
    // TODO 加一个判断是electron环境的变量
    if (!window['is_electron']) {
        window.chrome = getProxy();
    }
}
