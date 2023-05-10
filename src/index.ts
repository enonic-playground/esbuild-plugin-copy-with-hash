import { xxh3 } from '@node-rs/xxhash';
import bytes from 'bytes';
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
// @ts-ignore
// import { print } from 'q-i';


interface CopyWithHashPluginOptions {
	manifestFilePath?: string | ((options: PluginBuild['initialOptions']) => string)
	patterns: {
		context?: string
		from: string
		to: string
	}[]
}

const PLUGIN_NAME = 'copy-files-with-hash';
const BASE_36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';


function bigint2base(x: bigint, b: string ) {

	let base = BigInt( b.length );
	let result = '';

	while ( 0 < x ) {
		result = b.charAt( Number( x % base ) ) + result;
		x = x / base;
	}

	return result || '0';
}


export = (options: CopyWithHashPluginOptions): Plugin => ({
	name: PLUGIN_NAME,
	setup(build: PluginBuild) {
		// print({options}, { maxItems: Infinity });
		// const absWorkingDir = process.cwd();
		const {
			manifestFilePath,
			patterns,
		} = options;
		// print({absWorkingDir}, { maxItems: Infinity });
		const format = build.initialOptions.define?.['TSUP_FORMAT'].replace(/"/g,'').toUpperCase() || '';
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
			// print({metafile: result.metafile}, { maxItems: Infinity });

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
			for (let i = 0; i < keys.length; i++) {
				const src = keys[i];
				const {
					outDir,
					rel
				} = tasks[src];
				// print({ src, outDir, rel }, { maxItems: Infinity });

				const fileBuffer = readFileSync(src);
				// if (result.metafile) {
				// 	result.metafile.inputs[src] = {
				// 		bytes: statSync(src).size,
				// 		imports: []
				// 	};
				// }

				const bigInt = xxh3.xxh64(fileBuffer);
				const base36Digest = bigint2base(bigInt, BASE_36);
				const ext = extname(src);
				const filebase = basename(src, ext);
				const outFileName = `${filebase}-${base36Digest}${ext}`;
				const outFilePath = join(outDir,outFileName);
				// print({ ext, filebase, outFileName, outFilePath }, { maxItems: Infinity });

				if (existsSync(outFilePath)) {
					const fileBuffer2 = readFileSync(src);
					const bigInt2 = xxh3.xxh64(fileBuffer2);
					const base36Digest2 = bigint2base(bigInt2, BASE_36);
					if (base36Digest !== base36Digest2) {
						// console.debug(`${format} CPY updating ${rel||src} digest:${base36Digest} changed:${base36Digest2}`);
						writeFileSync(outFilePath, fileBuffer);
					// } else {
					// 	console.debug(`${format} CPY skipping ${rel||src} digest:${base36Digest} unchanged`);
					// 	// const location = {
					// 	// 	column: 0,
					// 	// 	file: 'file',
					// 	// 	length: 0,
					// 	// 	line: 0,
					// 	// 	lineText: 'lineText',
					// 	// 	namespace: 'namespace',
					// 	// 	suggestion: 'suggestion'
					// 	// };
					// 	// result.warnings.push({
					// 	// 	detail: 'detail',
					// 	// 	id: 'id',
					// 	// 	location,
					// 	// 	notes: [{
					// 	// 		location,
					// 	// 		text: 'note text'
					// 	// 	}],
					// 	// 	pluginName: PLUGIN_NAME,
					// 	// 	text: 'text'
					// 	// });
					}
				} else {
					writeFileSync(outFilePath, fileBuffer);
					console.info(`${format} CPY ${outFilePath} ${bytes(statSync(outFilePath).size)}`);
					// result.outputFiles?.push({
					// 	contents:
					// })
					// if (result.metafile) {
					// 	result.metafile.outputs[outFilePath] = {
					// 		imports: [],
					// 		exports: [],
					// 		inputs: {},
					// 		bytes: statSync(outFilePath).size
					// 	};
					// }
				}

				if (rel) {
					manifestObj[rel] = join(dirname(rel), outFileName);
				} else {
					manifestObj[src] = join(dirname(src), outFileName);
				}
			} // for

			writeFileSync(mfFP, JSON.stringify(manifestObj, null, 2));
			// print({manifestObj}, { maxItems: Infinity });
		});
	}
});
