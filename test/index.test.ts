import type { CopyWithHashPluginOptions } from '../src/index.d';

import {
	beforeEach,
	describe,
	expect,
	test,
} from '@jest/globals';
import {
	existsSync,
	readFileSync,
	statSync,
	utimesSync,
} from 'fs';
import { join } from 'path/posix';
// import mockConsole from 'jest-mock-console';
import { rimrafSync } from 'rimraf';
import copyWithHashPlugin from '../src/index';

const DEFAULT_OUT_DIR = 'test/output';

function buildOptions(pluginOptions: CopyWithHashPluginOptions, overrideBuildOptions = {}) {
	const defaultBuildOptions = {
		bundle: true,
		entryPoints: [],
		outdir: DEFAULT_OUT_DIR,
		logLevel: 'silent',
		logLimit: 0,
		plugins: [copyWithHashPlugin(pluginOptions)],
	}

	return {...defaultBuildOptions, ...overrideBuildOptions};
};

// mockConsole();

describe('copyWithHashPlugin', () => {

	beforeEach(() => {
		rimrafSync('test/output');
	});

	test('it returns a valid esbuild plugin interface', () => {
		const plugin = copyWithHashPlugin({
			patterns: [''],
		});
		expect(plugin).toHaveProperty('name');
		expect(plugin).toHaveProperty('setup');
		expect(plugin.name).toBe('copy-files-with-hash');
	});

	test('it should handle string pattern', async () => {
		const manifest = 'myManifest.json';
		const to = 'subDir';
		await require('esbuild').build(buildOptions({
			context: 'node_modules',
			manifest,
			patterns: [
				'esbuild/*.js',
			],
			to,
		}));
		const manifestPath = join(DEFAULT_OUT_DIR, to, manifest);
		expect(existsSync(manifestPath)).toBe(true);
		const buffer = readFileSync(manifestPath);
		const obj = JSON.parse(buffer.toString());
		const withOutHash = 'esbuild/install.js';
		const withHash = obj[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, to, withOutHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, to, withHash))).toBe(true);
	});

	test('it should handle addHashesToFileNames: false', async () => {
		const manifest = 'myManifest.json';
		const to = 'subDir';
		await require('esbuild').build(buildOptions({
			addHashesToFileNames: false,
			context: 'node_modules',
			manifest,
			patterns: [
				'esbuild/*.js',
			],
			to,
		}));
		const manifestPath = join(DEFAULT_OUT_DIR, to, manifest);
		expect(existsSync(manifestPath)).toBe(true);
		const buffer = readFileSync(manifestPath);
		const obj = JSON.parse(buffer.toString());
		const withOutHash = 'esbuild/install.js';
		const withHash = obj[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, to, withOutHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, to, withHash))).toBe(false);
	});

	test('it should hand object pattern', async () => {
		await require('esbuild').build(buildOptions({
			context: 'node_modules',
			manifest: 'myManifest.json',
			patterns: [{
				context: 'esbuild',
				from: '*.js',
				to: 'esbuild'
			}],
		}));
		expect(existsSync('test/output/myManifest.json')).toBe(true);
	});

	test('it should throw an error when there are no source files', async () => {
		expect.assertions(2);
		await expect(require('esbuild').build(buildOptions({
			patterns: ['nonExistant/*.js']
		}))).rejects.toThrow(/No files found!/);
		expect(existsSync('test/output/manifest.json')).toBe(false);
	});

	test('it should do nothing when mtime is unchanged', async () => {
		await require('esbuild').build(buildOptions({
			patterns: [ 'node_modules/esbuild/*.js' ]
		}));
		expect(existsSync('test/output/manifest.json')).toBe(true);
		const buffer = readFileSync('test/output/manifest.json');
		const obj = JSON.parse(buffer.toString());
		const withHash = obj['node_modules/esbuild/install.js']
		const path = join('test/output', withHash);
		expect(existsSync(path)).toBe(true);
		const before = statSync(path).mtime.getTime();

		await require('esbuild').build(buildOptions({
			patterns: [ 'node_modules/esbuild/*.js' ]
		}));
		const after = statSync(path).mtime.getTime();
		expect(after).toBe(before);
	});

	test('it should update when mtime is changed', async () => {
		await require('esbuild').build(buildOptions({
			patterns: [ 'node_modules/esbuild/*.js' ]
		}));
		expect(existsSync('test/output/manifest.json')).toBe(true);
		const buffer = readFileSync('test/output/manifest.json');
		const obj = JSON.parse(buffer.toString());
		const withHash = obj['node_modules/esbuild/install.js']
		const path = join('test/output', withHash);
		expect(existsSync(path)).toBe(true);
		const before = statSync(path).mtime.getTime();

		utimesSync(path, new Date(), new Date());
		const touched = statSync(path).mtime.getTime();
		expect(touched).not.toBe(before);

		await require('esbuild').build(buildOptions({
			patterns: [ 'node_modules/esbuild/*.js' ]
		}));
		const after = statSync(path).mtime.getTime();
		expect(after).toBe(before); // Same as source file
	});

	test('it should only generate the manifest when the build result contains no errors', async () => {
		expect.assertions(2);
		await expect(
			require('esbuild').build(
				buildOptions(
					{ patterns: [ 'node_modules/esbuild/*.js' ] },
					{ entryPoints: ['test/example-with-error.js'] }
				)
			)
		).rejects.toThrow(/Unterminated string literal/);
		expect(existsSync('test/output/manifest.json')).toBe(false);
	});

	test('it should get format from tsup', async () => {
		await require('esbuild').build(
			buildOptions(
				{ patterns: [ 'node_modules/esbuild/*.js' ] },
				{
					define: {
						TSUP_FORMAT: '"esm"'
					}
				}
			)
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
	});

	test('it should get outdir from outfile', async () => {
		await require('esbuild').build(
			buildOptions(
				{ patterns: [ 'node_modules/esbuild/*.js' ] },
				{
					outdir: undefined,
					outfile: 'test/output/whatever.js'
				}
			)
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
	});

	test('it should handle manifest string', async () => {
		await require('esbuild').build(
			buildOptions({
				manifest: 'mymanifest.json',
				patterns: [ 'node_modules/esbuild/*.js' ]
			})
		);
		expect(existsSync('test/output/mymanifest.json')).toBe(true);
	});

	test('it should handle manifest function', async () => {
		await require('esbuild').build(
			buildOptions(
				{
					manifest: (options) => {
						return `manifest.${options.define?.['TSUP_FORMAT'].replace(/"/g,'')}.json`
					},
					patterns: [ 'node_modules/esbuild/*.js' ]
				}, {
					define: {
						TSUP_FORMAT: '"esm"'
					}
				}
			)
		);
		expect(existsSync('test/output/manifest.esm.json')).toBe(true);
	});

	test('it should throw when manifest string is malformed', async () => {
		expect.assertions(2);
		await expect(
			require('esbuild').build(
				buildOptions({
					manifest: '',
					patterns: [ 'node_modules/esbuild/*.js' ]
				})
			)
		).rejects.toThrow(/manifest option malformed!/);
		expect(existsSync('test/output/manifest.json')).toBe(false);
	});

	test('it should throw when manifest function is malformed', async () => {
		expect.assertions(2);
		await expect(
			require('esbuild').build(
				buildOptions({
					manifest: () => '',
					patterns: [ 'node_modules/esbuild/*.js' ]
				})
			)
		).rejects.toThrow(/manifest option malformed!/);
		expect(existsSync('test/output/manifest.json')).toBe(false);
	});

	test('it should handle non silence', async () => {
		await require('esbuild').build(
			buildOptions(
				{
					patterns: [ 'node_modules/esbuild/*.js' ]
				}, {
					logLevel: undefined,
					logLimit: undefined
				}
			)
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
	});

	test("it should NOT copy sourcemap files when sourcemap is false", async () => {
		const ext = '.js';
		const base = 'index';
		const dir = '@cjs-exporter/globby/dist';
		const withOutHash = `${dir}/${base}${ext}`;
		await require('esbuild').build(
			buildOptions({
				context: 'node_modules',
				patterns: [ `${dir}/*.*` ]
			}, {
				sourcemap: false
			})
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, withOutHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withOutHash}.map`))).toBe(false);

		const manifestPath = join(DEFAULT_OUT_DIR, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath).toString());
		const withHash = manifest[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, withHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withHash}.map`))).toBe(false);
	});

	test("it should copy sourcemap files when sourcemap is true", async () => {
		const ext = '.js';
		const base = 'index';
		const dir = '@cjs-exporter/globby/dist';
		const withOutHash = `${dir}/${base}${ext}`;
		await require('esbuild').build(
			buildOptions({
				context: 'node_modules',
				patterns: [ `${dir}/*.*` ]
			}, {
				sourcemap: true // same as external
			})
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, withOutHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withOutHash}.map`))).toBe(false);

		const manifestPath = join(DEFAULT_OUT_DIR, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath).toString());
		const withHash = manifest[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, withHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withHash}.map`))).toBe(true);
	});

	test("it should copy sourcemap files when sourcemap is both", async () => {
		const ext = '.js';
		const base = 'index';
		const dir = '@cjs-exporter/globby/dist';
		const withOutHash = `${dir}/${base}${ext}`;
		await require('esbuild').build(
			buildOptions({
				context: 'node_modules',
				patterns: [ `${dir}/*.*` ]
			}, {
				sourcemap: 'both' // Combination of inline and external
			})
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, withOutHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withOutHash}.map`))).toBe(false);

		const manifestPath = join(DEFAULT_OUT_DIR, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath).toString());
		const withHash = manifest[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, withHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withHash}.map`))).toBe(true);
	});

	test("it should copy sourcemap files when sourcemap is external", async () => {
		const ext = '.js';
		const base = 'index';
		const dir = '@cjs-exporter/globby/dist';
		const withOutHash = `${dir}/${base}${ext}`;
		await require('esbuild').build(
			buildOptions({
				context: 'node_modules',
				patterns: [ `${dir}/*.*` ]
			}, {
				sourcemap: 'external' // Same as linked, but without the //# sourceMappingURL=
			})
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, withOutHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withOutHash}.map`))).toBe(false);

		const manifestPath = join(DEFAULT_OUT_DIR, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath).toString());
		const withHash = manifest[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, withHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withHash}.map`))).toBe(true);
	});

	test("it should NOT copy sourcemap files when sourcemap is inline", async () => {
		const ext = '.js';
		const base = 'index';
		const dir = '@cjs-exporter/globby/dist';
		const withOutHash = `${dir}/${base}${ext}`;
		await require('esbuild').build(
			buildOptions({
				context: 'node_modules',
				patterns: [ `${dir}/*.*` ]
			}, {
				sourcemap: 'inline'
			})
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, withOutHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withOutHash}.map`))).toBe(false);

		const manifestPath = join(DEFAULT_OUT_DIR, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath).toString());
		const withHash = manifest[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, withHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withHash}.map`))).toBe(false);
	});

	test("it should copy sourcemap files when sourcemap is linked", async () => {
		const ext = '.js';
		const base = 'index';
		const dir = '@cjs-exporter/globby/dist';
		const withOutHash = `${dir}/${base}${ext}`;
		await require('esbuild').build(
			buildOptions({
				context: 'node_modules',
				patterns: [ `${dir}/*.*` ]
			}, {
				sourcemap: 'linked'
			})
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, withOutHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withOutHash}.map`))).toBe(false);

		const manifestPath = join(DEFAULT_OUT_DIR, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath).toString());
		const withHash = manifest[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, withHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withHash}.map`))).toBe(true);
	});

	test('it should continue without warning when a map file is missing', async () => {
		await require('esbuild').build(
			buildOptions(
				{
					patterns: [ 'node_modules/esbuild/*.js' ]
				}, {
					sourcemap: 'external'
				}
			)
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
	});

	test('it should handle addHashesToFileNames: false', async () => {
		const ext = '.js';
		const base = 'index';
		const dir = '@cjs-exporter/globby/dist';
		const withOutHash = `${dir}/${base}${ext}`;
		await require('esbuild').build(
			buildOptions({
				addHashesToFileNames: false,
				context: 'node_modules',
				patterns: [ `${dir}/*.*` ]
			}, {
				sourcemap: 'linked'
			})
		);
		expect(existsSync('test/output/manifest.json')).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, withOutHash))).toBe(true);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withOutHash}.map`))).toBe(true);

		const manifestPath = join(DEFAULT_OUT_DIR, 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath).toString());
		const withHash = manifest[withOutHash]
		expect(existsSync(join(DEFAULT_OUT_DIR, withHash))).toBe(false);
		expect(existsSync(join(DEFAULT_OUT_DIR, `${withHash}.map`))).toBe(false);
	});

});
