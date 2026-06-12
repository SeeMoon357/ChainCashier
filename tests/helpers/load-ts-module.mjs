import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const projectRoot = path.resolve('.');
const tempRootBase = path.resolve('./.codex-test-tmp');

function normalizeSlashes(value) {
	return value.replace(/\\/g, '/');
}

function resolveLocalImport(fromFile, specifier) {
	if (specifier.startsWith('@/')) {
		return resolveSourceFile(path.resolve(projectRoot, specifier.slice(2)));
	}

	if (specifier.startsWith('.')) {
		return resolveSourceFile(path.resolve(path.dirname(fromFile), specifier));
	}

	return null;
}

function resolveSourceFile(basePath) {
	const candidates = [
		basePath,
		`${basePath}.ts`,
		`${basePath}.tsx`,
		path.join(basePath, 'index.ts'),
		path.join(basePath, 'index.tsx'),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

function toOutputPath(tempRoot, sourcePath) {
	const relativePath = path.relative(projectRoot, sourcePath);
	return path.join(
		tempRoot,
		relativePath.replace(/\.(ts|tsx)$/, '.mjs'),
	);
}

function replaceSpecifier(source, originalSpecifier, replacementSpecifier) {
	return source
		.split(`'${originalSpecifier}'`)
		.join(`'${replacementSpecifier}'`)
		.split(`"${originalSpecifier}"`)
		.join(`"${replacementSpecifier}"`);
}

export async function loadTsModule(entryRelativePath) {
	const entryPath = path.resolve(entryRelativePath);
	fs.mkdirSync(tempRootBase, { recursive: true });
	const tempRoot = fs.mkdtempSync(path.join(tempRootBase, 'codex-ts-load-'));
	const visited = new Map();

	function compileFile(sourcePath) {
		if (visited.has(sourcePath)) {
			return visited.get(sourcePath);
		}

		const source = fs.readFileSync(sourcePath, 'utf8');
		const outputPath = toOutputPath(tempRoot, sourcePath);
		visited.set(sourcePath, outputPath);

		const importSpecifiers = ts.preProcessFile(source).importedFiles.map(
			(file) => file.fileName,
		);

		let transpiled = ts.transpileModule(source, {
			compilerOptions: {
				module: ts.ModuleKind.ES2022,
				target: ts.ScriptTarget.ES2022,
				jsx: ts.JsxEmit.ReactJSX,
			},
			fileName: sourcePath,
		}).outputText;

		for (const specifier of importSpecifiers) {
			const resolved = resolveLocalImport(sourcePath, specifier);
			if (!resolved) {
				continue;
			}

			const dependencyOutputPath = compileFile(resolved);
			const relativeSpecifier = normalizeSlashes(
				path.relative(path.dirname(outputPath), dependencyOutputPath),
			);
			const finalSpecifier = relativeSpecifier.startsWith('.')
				? relativeSpecifier
				: `./${relativeSpecifier}`;

			transpiled = replaceSpecifier(transpiled, specifier, finalSpecifier);
		}

		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, transpiled, 'utf8');
		return outputPath;
	}

	const compiledEntry = compileFile(entryPath);
	return import(pathToFileURL(compiledEntry).href);
}
