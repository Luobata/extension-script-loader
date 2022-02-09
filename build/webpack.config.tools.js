const path = require('path');
const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const baseConfig = require('./webpack.config.base');
const ExtensionReloader = require('webpack-extension-reloader');

const assetsSubDirectory = 'dist/static/';
const cssLoader = ['vue-style-loader', 'css-loader', 'postcss-loader'];

const entries = {
    background: './src/background/index.ts',
    content: [],
    popup: ['./src/popup/index.ts'],
};

const plugins = [
    new HtmlWebpackPlugin({
        inject: false,
        filename: 'index.html',
        template: 'src/template/index.html',
        chunks: ['popup-index'],
        title: 'script loader',
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


console.log(Object.values(entries));

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
