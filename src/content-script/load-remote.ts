/**
 * @desc 加载远端代码钩子 需要有一个脚本
 */
import ChromeCrossMessenger from '../util/chrome-cross-messenger/chrome-cross-messenger';
import { loadRemoteContent } from '../util/const';
import { hackChrome } from '../util/chrome-hack';
import './chontent-api-extension';
import './inject-api-extension';

const cross = ChromeCrossMessenger.getInstance();

cross.send(loadRemoteContent);
hackChrome();
