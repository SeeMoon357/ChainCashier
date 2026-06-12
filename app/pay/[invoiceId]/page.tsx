import ChainCashierDemo from '@/components/ChainCashierDemo';

type PayPageProps = {
	params: Promise<{ invoiceId: string }>;
};

export default async function PayPage({ params }: PayPageProps) {
	const { invoiceId } = await params;
	return <ChainCashierDemo initialInvoiceId={invoiceId} />;
}

