/**
 * 模块解析父类
 */

export default abstract class Parser {
    protected _originCode: string;

    constructor(code: string) {
        this._originCode = code;
    }

    public abstract destroy(): void;

    // public abstract load();
}
