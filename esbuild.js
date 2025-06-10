const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',
	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			if (result.errors.length) {
				result.errors.forEach(({ text, location }) => {
					console.error(`✘ [ERROR] ${text}`);
					if (location) {
						console.error(`    ${location.file}:${location.line}:${location.column}`);
					}
				});
			} else {
				console.log('[watch] build finished ✅');
			}
		});
	}
};

async function main() {
	const options = {
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	};

	if (watch) {
		const ctx = await esbuild.context(options);
		await ctx.watch();
		console.log('[watch] Watching for changes...');
	} else {
		await esbuild.build(options);
		console.log('✅ Build completed (non-watch mode)');
	}
}

main().catch((e) => {
	console.error('❌ Build failed:', e);
	process.exit(1);
});
