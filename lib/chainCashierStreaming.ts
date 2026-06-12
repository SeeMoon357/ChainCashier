export function splitTypewriterText(text: string): string[] {
	const tokens: string[] = [];
	let index = 0;

	while (index < text.length) {
		const rest = text.slice(index);
		const newlineMatch = rest.match(/^\n+/);
		if (newlineMatch) {
			tokens.push(newlineMatch[0]);
			index += newlineMatch[0].length;
			continue;
		}

		const markdownMarker = rest.match(/^(\*\*|__|`{1,3}|\[[^\]]{1,40}\]\([^)]+\))/);
		if (markdownMarker) {
			tokens.push(markdownMarker[0]);
			index += markdownMarker[0].length;
			continue;
		}

		const asciiWord = rest.match(/^[A-Za-z0-9._:/-]+[\s]?/);
		if (asciiWord) {
			const word = asciiWord[0];
			for (let start = 0; start < word.length; start += 8) {
				tokens.push(word.slice(start, start + 8));
			}
			index += word.length;
			continue;
		}

		const point = text.codePointAt(index);
		if (point === undefined) break;
		const char = String.fromCodePoint(point);
		tokens.push(char);
		index += char.length;
	}

	return tokens;
}
