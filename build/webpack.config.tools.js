const fromEntries = require('object.fromentries');
const path = require('path');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const baseConfig = require('./webpack.config.base');
const ExtensionReloader = require('webpack-extension-reloader');

const assetsSubDirectory = 'dist/static/';
const cssLoader = ['vue-style-loader', 'css-loader', 'postcss-loader'];

const entries = {
    background: 'background/background-all.js',
    content: [],
    popup: ['options.js', '../framework/core/popup-index.ts'],
};

const plugins = [
    new HtmlWebpackPlugin({
        inject: false,
        filename: 'index.html',
        template: 'src/template/index.html',
        chunks: ['popup-index'],
        title: '广审插件',
        minify: {
            collapseWhitespace: true,
            removeComments: true,
            useShortDoctype: true,
        },
    }),
];

if (process.env.NODE_ENV === 'development') {
    plugins.push(
        new ExtensionReloader({
            entries: {
                contentScript: Object.keys(entries.content),
                background: 'background',
                extensionPage: Object.keys(entries.popup),
            },
        }),
    );
}

module.exports = merge(baseConfig, {
    entry: Object.assign({}, ...Object.values(entries)),
    output: {
        path: path.join(__dirname, '../dev-tools/'),
        filename: 'dist/[name].js',
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: cssLoader,
            },
            {
                test: /\.styl(us)?$/,
                use: [...cssLoader, 'stylus-loader'],
            },
            {
                test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 10000,
                            name: `${assetsSubDirectory}img/[name].[hash:7].[ext]`,
                        },
                    },
                ],
            },
        ],
    },
    plugins,
});
