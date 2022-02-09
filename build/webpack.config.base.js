const path = require('path');
const webpack = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin');

function resolve(dir) {
    return path.join(__dirname, '..', dir);
}

module.exports = {
    mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    devtool:
        process.env.NODE_ENV === 'development' ? 'eval-source-map' : 'none',
    resolve: {
        extensions: ['.ts', '.js', '.vue', '.json', '.tsx'],
        alias: {
            SRC: path.resolve(__dirname, '../src'),
            '@': path.resolve(__dirname, '../src/components'),
            LIB: path.resolve(__dirname, '../src/lib'),
            CLIB: path.resolve(__dirname, '../src/components/lib'),
            EUtil: path.resolve(__dirname, '../src/entry-util'),
            Const: path.resolve(__dirname, '../src/const'),
        },
    },
    module: {
        rules: [
            {
                test: /\.(js)$/,
                use: [
                    {
                        loader: 'eslint-loader',
                        options: {
                            formatter: require('eslint-friendly-formatter'),
                            emitWarning: false,
                        },
                    },
                ],
                enforce: 'pre',
                include: [resolve('src')],
            },
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'cache-loader',
                    },
                    {
                        loader: 'ts-loader',

                        options: {
                            transpileOnly: true,
                            experimentalWatchApi: true,
                        },
                    },
                ],
            },
            {
                test: /\.vue$/,
                use: ['vue-loader'],
            },
            {
                test: /\.pug$/,
                use: ['pug-plain-loader'],
            },
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: true,
                        },
                    },
                ],
            },
        ],
    },
    plugins: [new webpack.NoEmitOnErrorsPlugin(), new VueLoaderPlugin()],
};
