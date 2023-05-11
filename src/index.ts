import { xxh3 } from '@node-rs/xxhash';
import {
	BuildResult,
	Plugin,
	PluginBuild
} from 'esbuild';
import {
	existsSync,
	mkdirSync,
	statSync,
	readFileSync,
	writeFileSync,
} from 'fs';
import { globSync } from 'glob';
import {
	basename,
	dirname,
	extname,
	join,
	relative,
} from 'path';
import { createLogger } from './log';
import { reportSize } from './reportSize';
// @ts-ignore
// import { print } from 'q-i';


interface CopyWithHashPluginOptions {
	hash?: (fileBuffer: Buffer) => string
	manifestFilePath?: string | ((options: PluginBuild['initialOptions']) => string)
	patterns: {
		context?: string
		from: string
		to: string
	}[]
}

const PLUGIN_NAME = 'copy-files-with-hash';
const BASE_36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';


function bigint2base(bigint: bigint, base: string) {

	let bib = BigInt( base.length );
	let result = '';

	while ( 0 < bigint ) {
		result = base.charAt( Number( bigint % bib ) ) + result;
		bigint = bigint / bib;
	}
	// print({result, length: result.length});
	return result || '0';
}


export = (options: CopyWithHashPluginOptions): Plugin => ({
	name: PLUGIN_NAME,
	setup(build: PluginBuild) {
		// print({options}, { maxItems: Infinity });
		// const absWorkingDir = process.cwd();
		const format = build.initialOptions.define?.['TSUP_FORMAT'].replace(/"/g,'').toUpperCase() || '';
		const logger = createLogger(PLUGIN_NAME);
		const {
			hash = (fileBuffer: Buffer) => bigint2base(xxh3.xxh64(fileBuffer), BASE_36),
			manifestFilePath,
			patterns,
		} = options;
		// print({absWorkingDir}, { maxItems: Infinity });
		const tasks: Record<string,{
			outDir: string,
			rel?: string
		}> = {};
		for (let i = 0; i < patterns.length; i++) {
			const {
				context,
				from,
				to
			} = patterns[i];
			const files = globSync(from, {absolute: false});
			// print({files}, { maxItems: Infinity });
			if (!files.length) {
				throw new Error(`No files found! from:${from}`);
			}
			for (let j = 0; j < files.length; j++) {
				const file = files[j];
				if (context) {
					const rel = relative(context, file);
					// print({rel}, { maxItems: Infinity });
					const dir = dirname(rel);
					// print({dir}, { maxItems: Infinity });
					const anOutDir = join(to, dir);
					// print({anOutDir}, { maxItems: Infinity });
					if (!existsSync(anOutDir) || !statSync(anOutDir).isDirectory()) {
						mkdirSync(anOutDir, { recursive: true });
					}
					tasks[file] = {
						rel,
						outDir: anOutDir
					};
				} else {
					const outDir = join(to, dirname(file));
					if (!existsSync(outDir) || !statSync(outDir).isDirectory()) {
						mkdirSync(outDir, { recursive: true });
					}
					tasks[file] = { outDir };
				}
			}
		} // for

		build.onEnd((result: BuildResult) => {
			// print({initialOptions: build.initialOptions}, { maxItems: Infinity });

			// Only proceed if the build result does not have any errors.
			if (result.errors.length > 0) {
				return;
			}

			const mfFP = typeof manifestFilePath === 'function'
				? manifestFilePath(build.initialOptions)
				: manifestFilePath || 'manifest.json';

			const manifestObj: Record<string,string> = existsSync(mfFP)
				? JSON.parse(readFileSync(mfFP).toString())
				: {};
			// print({manifestObj}, { maxItems: Infinity });

			const keys = Object.keys(tasks);
			const files: Record<string,number> = {};
			for (let i = 0; i < keys.length; i++) {
				const src = keys[i];
				const {
					outDir,
					rel
				} = tasks[src];
				// print({ src, outDir, rel }, { maxItems: Infinity });

				const fileBuffer = readFileSync(src);
				const contenthash = hash(fileBuffer);
				const ext = extname(src);
				const filebase = basename(src, ext);
				const outFileName = `${filebase}-${contenthash}${ext}`;
				const outFilePath = join(outDir,outFileName);
				// print({ ext, filebase, outFileName, outFilePath }, { maxItems: Infinity });

				if (existsSync(outFilePath)) {
					const contenthash2 = hash(readFileSync(src));
					if (contenthash !== contenthash2) {
						logger.warn(`${format} updating ${rel||src} contenthash:${contenthash} changed:${contenthash2}`);
						writeFileSync(outFilePath, fileBuffer);
					// } else {
					// 	logger.info(`${format} skipping ${rel||src} contenthash:${contenthash} unchanged`);
					}
				} else {
					writeFileSync(outFilePath, fileBuffer);
					files[outFilePath] = statSync(outFilePath).size;
				}

				if (rel) {
					manifestObj[rel] = join(dirname(rel), outFileName);
				} else {
					manifestObj[src] = join(dirname(src), outFileName);
				}
			} // for
			reportSize(logger, format, files);

			writeFileSync(mfFP, JSON.stringify(manifestObj, null, 2));
			// print({manifestObj}, { maxItems: Infinity });
		});
	}
});
