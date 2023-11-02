import type { PluginBuild } from 'esbuild';
import type { CopyWithHashPluginOptions } from './index.d';


// import { xxh3 } from '@node-rs/xxhash'; // Didn't work on windows :(
import { XXH64 } from 'xxh3-ts';
import {
	BuildResult,
	Plugin,
} from 'esbuild';
// import {sync} from 'fast-glob';
import {
	cpSync,
	existsSync,
	mkdirSync,
	statSync,
	readFileSync,
	writeFileSync,
} from 'fs';
// import { globSync } from 'glob';
import { globbySync } from '@cjs-exporter/globby';
import {
	basename,
	dirname,
	extname,
	join,
	relative,
} from 'path/posix';
import bigint2base from './bigint2base';
import { createLogger, setSilent } from './log';
import { reportSize } from './reportSize';


const PLUGIN_NAME = 'copy-files-with-hash';
const MANIFEST_DEFAULT = 'manifest.json';
const BASE_36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';


export = (options: CopyWithHashPluginOptions): Plugin => ({
	name: PLUGIN_NAME,
	setup(build: PluginBuild) {
		const {
			// absWorkingDir = process.cwd(),
			logLevel,
			outdir,
			outfile,
			sourcemap
		} = build.initialOptions;
		setSilent(logLevel === 'silent');
		const format = build.initialOptions.define?.['TSUP_FORMAT'].replace(/"/g,'').toUpperCase() || '';
		const cpyMapFiles = sourcemap === true || sourcemap === 'external' || sourcemap === 'linked' || sourcemap === 'both';
		const logger = createLogger(PLUGIN_NAME);
		const {
			addHashesToFileNames = true,
			context: rootContext = '',
			hash = (fileBuffer: Buffer) => bigint2base(XXH64(fileBuffer), BASE_36),
			manifest = MANIFEST_DEFAULT,
			patterns,
			to: rootTo = ''
		} = options;
		const relOutDir = join(outdir || dirname(outfile as string), rootTo);

		const mfFP = typeof manifest === 'function'
			? manifest(build.initialOptions)
			: manifest;

		if (!mfFP) {
			throw new Error('manifest option malformed!');
		}

		const manifestFilePathRel = join(relOutDir, mfFP);

		const tasks: Record<string,{
			outDir: string,
			rel: string
		}> = {};

		outer: for (let i = 0; i < patterns.length; i++) {
			const value = patterns[i];
			let context = '', from: string, to = '';
			if (typeof value === 'string') {
				from = value;
			} else {
				if (value.context) context = value.context;
				from = value.from;
				if (value.to) to = value.to;
			}
			// const fromGlob = join(absWorkingDir, rootContext, context, from);
			const fromGlob = join(rootContext, context, from);
			// logger.info('fromGlob', fromGlob);
			// const files = globSync(fromGlob, {absolute: false});
			const files = globbySync(fromGlob, {absolute: false});
			// const files = sync(fromGlob
			// 	// , {
			// 	// 	absolute: false, // false by default
			// 	// 	caseSensitiveMatch: true, // true by default
			// 	// 	globstar: true, // true by default
			// 	// 	onlyFiles: true, // true by default
			// 	// 	unique: true, // true by default
			// 	// }
			// );
			// logger.info('files', files);
			if (!files.length) {
				throw new Error(`No files found! fromGlob:${fromGlob}`);
			}
			inner: for (let j = 0; j < files.length; j++) {
				const file = files[j];
				const rel = relative(join(rootContext, context), file);
				const dir = dirname(rel);
				const anOutDir = join(relOutDir, to, dir);
				if (!existsSync(anOutDir) || !statSync(anOutDir).isDirectory()) {
					mkdirSync(anOutDir, { recursive: true });
				}
				tasks[file] = {
					rel,
					outDir: anOutDir
				};
			} // for inner
		} // for outer

		build.onEnd((result: BuildResult) => {
			// Only proceed if the build result does not have any errors.
			if (result.errors.length > 0) {
				return;
			}

			const manifestObj: Record<string,string> = existsSync(manifestFilePathRel)
				? JSON.parse(readFileSync(manifestFilePathRel).toString())
				: {};
			const manifestObjJson = JSON.stringify(manifestObj);
			const files: Record<string,number> = {};
			const keys = Object.keys(tasks);

			for (let i = 0; i < keys.length; i++) {
				const src = keys[i];
				if (
					extname(src) === '.map'
					&& (
						!sourcemap // Skip map files when sourcemap: false
						|| cpyMapFiles // Map files are handled when the corresponding js file is processed
					)
				) {
					continue;
				}

				const {
					outDir,
					rel
				} = tasks[src];
				const fileBuffer = readFileSync(src);
				const contenthash = hash(fileBuffer);
				const ext = extname(src);
				const filebase = basename(src, ext);
				const outFileNameWithHash = `${filebase}-${contenthash}${ext}`;
				const outFileName = addHashesToFileNames ? outFileNameWithHash : `${filebase}${ext}`;
				const outFilePath = join(outDir,outFileName);

				const filesToCopy = [{
					fileNameWithHash: outFileNameWithHash,
					fromRelFilePath: src,
					toFullFilePath: outFilePath,
					toRelFilePath: rel
				}];

				if (cpyMapFiles) {
					// NOTE: could read the js file and get the //# sourceMappingURL=... and check that the file exists
					filesToCopy.push({
						fileNameWithHash: `${outFileNameWithHash}.map`,
						fromRelFilePath: `${src}.map`,
						toFullFilePath: `${outFilePath}.map`,
						toRelFilePath: `${rel}.map`
					});
				}

				for (let j = 0; j < filesToCopy.length; j++) {
					const {
						fileNameWithHash,
						fromRelFilePath,
						toFullFilePath,
						toRelFilePath
					} = filesToCopy[j];
					try {
						if (existsSync(toFullFilePath)) {
							const s = statSync(fromRelFilePath);
							const t = statSync(toFullFilePath);

							if (s.mtime.getTime() !== t.mtime.getTime()) {
								cpSync(fromRelFilePath, toFullFilePath, {
									dereference: true,
									errorOnExist: false,
									force: true,
									preserveTimestamps: true
								});
								files[toFullFilePath] = statSync(toFullFilePath).size;
							} else {
								files[`(unchanged) ${toFullFilePath}`] = statSync(toFullFilePath).size;
							} // if modified ... else ...
						} else {
							cpSync(fromRelFilePath, toFullFilePath, {
								dereference: true,
								errorOnExist: false,
								force: true,
								preserveTimestamps: true
							});
							files[toFullFilePath] = statSync(toFullFilePath).size;
						} // if exist ... else ...

						manifestObj[toRelFilePath] = join(dirname(toRelFilePath), fileNameWithHash);
						// manifestObj[rel] = join(dirname(rel), outFileName);
					} catch (e) {
						/* istanbul ignore if */ // The else branch is not ignored :)
						if (!fromRelFilePath.endsWith('.map')) { // Ignore missing map files
							throw e; // Rethrow (Only possible if src file is deleted while plugin is working)
						}
					}
				} // for filesToCopy
			} // for tasks

			if (JSON.stringify(manifestObj) !== manifestObjJson) {
				writeFileSync(manifestFilePathRel, JSON.stringify(manifestObj, null, 2));
				files[manifestFilePathRel] = statSync(manifestFilePathRel).size;
			} else {
				files[`(unchanged) ${manifestFilePathRel}`] = statSync(manifestFilePathRel).size;
			}

			reportSize(logger, format, files);
		}); // build.onEnd
	} // setup
});
