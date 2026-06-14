import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
	const filePath = path.join(process.cwd(), 'public', 'pitch', 'index.html');
	const html = await readFile(filePath, 'utf8');

	return new Response(html, {
		headers: {
			'cache-control': 'public, max-age=3600',
			'content-type': 'text/html; charset=utf-8',
		},
	});
}
