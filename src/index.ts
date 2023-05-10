import { xxh3 } from '@node-rs/xxhash';
import {
	// BuildResult, Metafile,
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
import {
	basename,
	extname,
} from 'path';
// @ts-ignore
import { print } from 'q-i';


interface CopyWithHashPluginOptions {
	src: string
	outDir: string
}


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
	name: 'copy-files-with-hash',
	setup(build: PluginBuild) {
		// print({options: options}, { maxItems: Infinity });
		const {
			outDir,
			src
		} = options;
		if (!existsSync(src)) {
			throw new Error(`Src doesn't exist! ${src}`);
		}
		if (!statSync(src).isFile()) {
			throw new Error(`Src is not a file! ${src}`);
		}
		build.onEnd(() => {
			// print({initialOptions: build.initialOptions}, { maxItems: Infinity });
			const fileBuffer = readFileSync(src);
			const bigInt = xxh3.xxh64(fileBuffer);
			const base36Digest = bigint2base(bigInt, BASE_36);
			const ext = extname(src);
			const filebase = basename(src, ext);
			const outFileName = `${filebase}-${base36Digest}${ext}`;
			if (!existsSync(outDir) || !statSync(outDir).isDirectory()) {
				mkdirSync(outDir, { recursive: true });
			}
			writeFileSync(`${outDir}/${filebase}-${outFileName}`, fileBuffer);

			const manifestFilePath = `${outDir}/manifest.json`;
			const manifestObj: Record<string,string> = existsSync(manifestFilePath)
				? JSON.parse(readFileSync(manifestFilePath).toString())
				: {};
			manifestObj[filebase] = outFileName;
			writeFileSync(manifestFilePath, JSON.stringify(manifestObj, null, 2));
		});
	}
});
