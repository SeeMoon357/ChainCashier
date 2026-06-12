import ChainCashierChat from '@/components/ChainCashierChat';

type PayPageProps = {
	params: Promise<{ invoiceId: string }>;
};

export default async function PayPage({ params }: PayPageProps) {
	const { invoiceId } = await params;
	return (
		<ChainCashierChat
			role='payer'
			initialInvoiceId={invoiceId}
		/>
	);
}
