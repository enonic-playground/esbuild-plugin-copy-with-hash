# esbuild-plugin-copy-with-hash

## Installation

```sh
npm install --save-dev @enonic/esbuild-plugin-copy-with-hash
```

## Usage

```javascript
import esbuild from 'esbuild'
import copyWithHashPlugin from 'esbuild-plugin-copy-with-hash';

await esbuild.build({
	// ...
	plugins: [
		copyWithHashPlugin({
			context: 'node_modules',
			patterns: [
				'react/{cjs,umd}/*.js',
				'react-dom/{cjs,umd}/*.js',
			]
		})
	],
	// ...
})
```

### Usage (tsup)

```ts
import copyWithHashPlugin from 'esbuild-plugin-copy-with-hash';

export default defineConfig((options) => {
	return {
		// ...
		esbuildPlugins: [
			copyWithHashPlugin({
				context: 'node_modules',
				patterns: [
					'react/{cjs,umd}/*.js',
					'react-dom/{cjs,umd}/*.js',
				]
			})
		],
		// ...
	}
}
```

## Options

### `options?.context`

Type: `String`

Default: `''`

`options?.context` is relative to `cwd()`.

### `options?.hash`

Type: `function`

Default: (fileBuffer: Buffer) => bigint2base(xxh3.xxh64(fileBuffer), '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')

The default hashing algorithm is xxh3.xxh64 with uppercase base36.
This will typically yield a contenthash that is 12 to 13 characters long.
You can provide your own hashing algorithm, keep in mind some filesystems are case "insensitive".

### `options?.manifest`

Type: `String`

Default: `'manifest.json'`

The path (relative to `esbuildOptions.outdir` joined with `options?.to`) to the generated manifest file.

### `options.patterns`

Type: `(string | {
	context?: string
	from: string
	to?: string
})[]`

A list of patterns (globs) to copy.

The glob is relative to `cwd()` joined with `options?.context` and `pattern?.context`.

The `pattern?.to` is relative to `esbuildOptions.outdir` joined with `options?.to`.

```javascript
import esbuild from 'esbuild'
import copyWithHashPlugin from 'esbuild-plugin-copy-with-hash';

await esbuild.build({
	// ...
	plugins: [
		copyWithHashPlugin({
			context: 'node_modules',
			patterns: [
				'react/{cjs,umd}/*.js',
				{
					context: 'react-dom',
					from: '/{cjs,umd}/*.js',
					to: 'react-dom/'
				}
			],
			to: 'subdir'
		})
	],
	// ...
})
```

### `options?.to`

Type: `String`

Default: `''`

`options?.to` is relative to `esbuildOptions.outdir`.

## License

MIT
