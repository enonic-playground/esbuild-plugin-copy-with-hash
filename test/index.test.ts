import type { CopyWithHashPluginOptions } from '../src/index.d';

import {
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
import { join } from 'path';
// import mockConsole from 'jest-mock-console';
import { rimrafSync } from 'rimraf';
import copyWithHashPlugin from '../src/index';


function buildOptions(pluginOptions: CopyWithHashPluginOptions, overrideBuildOptions = {}) {
	const defaultBuildOptions = {
		bundle: true,
		entryPoints: [],
		outdir: 'test/output',
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
		await require('esbuild').build(buildOptions({
			context: 'node_modules',
			manifest: 'myManifest.json',
			patterns: [
				'esbuild/*.js',
			],
			to: 'subDir',
		}));
		expect(existsSync('test/output/subDir/myManifest.json')).toBe(true);
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
});
