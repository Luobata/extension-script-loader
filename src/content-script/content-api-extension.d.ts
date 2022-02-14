import contentGlobal from './chontent-api-extension';
import injectGlobal from './inject-api-extension';
import logger from '../core/logger';
import contentLogger from '../content/logger';

/**
 * @desc 扩展global 声明
 */
declare global {
    interface Window {
        // 针对content global专用的劫持
        contentGlobal: typeof contentGlobal;
        contentLogger: ReturnType<typeof contentLogger>;
        injectGlobal: typeof injectGlobal;

        logger: ReturnType<typeof logger>;
    }
    const global_content_key: string;
    const global_inject_key: string;
}

export {};
