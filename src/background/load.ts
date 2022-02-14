/**
 * @desc load content script
 */

export default class scriptLoader {
    constructor() {}

    static async fetchCodeInner(src: string): Promise<string> {
        const contentRes = await fetch(src);

        if (contentRes.status !== 200) {
            console.log({
                type: 'error',
                data: `${contentRes.url}: ${contentRes.status} ${contentRes.statusText}`,
            });
        } else {
            const result = await contentRes.text();

            return result;
        }
    }
}
