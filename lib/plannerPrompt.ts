export function buildPlannerPrompt(input: {
	userAddress: string;
	walletChainId: number;
	userMessage: string;
	messages: Array<{ role: 'user' | 'ai'; content: string }>;
}): string {
	const history = input.messages
		.slice(-6)
		.map((message) => `${message.role}: ${message.content}`)
		.join('\n');

	return [
		`Wallet address: ${input.userAddress}`,
		`Wallet chain: ${input.walletChainId}`,
		`Current message: ${input.userMessage}`,
		history ? `Recent messages:\n${history}` : '',
	]
		.filter(Boolean)
		.join('\n\n');
}
