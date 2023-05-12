import type { PluginBuild } from 'esbuild';


export interface CopyWithHashPluginOptions {
	context?: string
	hash?: (fileBuffer: Buffer) => string
	manifest?: string | ((options: PluginBuild['initialOptions']) => string)
	patterns: (string | {
		context?: string
		from: string
		to?: string
	})[]
	to?: string
}
